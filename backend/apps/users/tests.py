from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import MenopauseSurveyResponse, UserConsent

User = get_user_model()


class SignupTests(APITestCase):
    def test_signup_returns_tokens_and_hides_password(self):
        response = self.client.post(reverse('users:signup'), {
            'username': 'newbie',
            'password': 'pw123456',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertNotIn('password', response.data)

    def test_rejects_duplicate_username(self):
        User.objects.create_user(username='taken', password='pw123456')

        response = self.client.post(reverse('users:signup'), {
            'username': 'taken',
            'password': 'pw123456',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_password(self):
        response = self.client.post(reverse('users:signup'), {'username': 'nopass'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_issued_token_grants_access_to_me(self):
        signup = self.client.post(reverse('users:signup'), {
            'username': 'newbie2',
            'password': 'pw123456',
        }, format='json')

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {signup.data['access']}")
        response = self.client.get(reverse('users:me'), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'newbie2')


class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sungjin', password='correct-pw')

    def test_login_returns_tokens(self):
        response = self.client.post(reverse('users:login'), {
            'username': 'sungjin', 'password': 'correct-pw',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_rejects_wrong_password(self):
        response = self.client.post(reverse('users:login'), {
            'username': 'sungjin', 'password': 'wrong-pw',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_rejects_unknown_username(self):
        response = self.client.post(reverse('users:login'), {
            'username': 'ghost', 'password': 'whatever',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TokenRefreshTests(APITestCase):
    def setUp(self):
        User.objects.create_user(username='sungjin', password='correct-pw')
        login = self.client.post(reverse('users:login'), {
            'username': 'sungjin', 'password': 'correct-pw',
        }, format='json')
        self.refresh_token = login.data['refresh']

    def test_refresh_returns_new_access_token(self):
        response = self.client.post(reverse('users:token-refresh'), {
            'refresh': self.refresh_token,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_rejects_invalid_refresh_token(self):
        response = self.client.post(reverse('users:token-refresh'), {
            'refresh': 'not-a-real-token',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class DemoLoginTests(APITestCase):
    def test_creates_demo_account_and_returns_tokens(self):
        response = self.client.post(reverse('users:demo-login'), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertTrue(User.objects.filter(username='demo').exists())

    def test_second_call_reuses_the_same_account(self):
        self.client.post(reverse('users:demo-login'), format='json')
        self.client.post(reverse('users:demo-login'), format='json')

        self.assertEqual(User.objects.filter(username='demo').count(), 1)


class MeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sungjin', password='pw123456', email='sungjin@example.com')
        self.other = User.objects.create_user(username='someone-else', password='pw123456')

    def _authenticate_as(self, username, password):
        login = self.client.post(reverse('users:login'), {
            'username': username, 'password': password,
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_returns_my_info_when_authenticated(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.get(reverse('users:me'), format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'sungjin')
        self.assertEqual(response.data['email'], 'sungjin@example.com')

    def test_requires_authentication(self):
        response = self.client.get(reverse('users:me'), format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_only_the_requesting_users_info(self):
        self._authenticate_as('someone-else', 'pw123456')

        response = self.client.get(reverse('users:me'), format='json')

        self.assertEqual(response.data['username'], 'someone-else')
        self.assertNotEqual(response.data['username'], self.user.username)


class MenopauseSurveyTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sungjin', password='pw123456')
        self.other = User.objects.create_user(username='someone-else', password='pw123456')
        self.url = reverse('users:menopause-survey')

    def _authenticate_as(self, username, password):
        login = self.client.post(reverse('users:login'), {
            'username': username, 'password': password,
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_new_response_is_created_with_computed_stage(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.post(self.url, {'choice': 0}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['choice'], 0)
        self.assertEqual(response.data['stage'], 'peri')
        self.assertIn('answered_at', response.data)

    def test_each_choice_maps_to_its_stage(self):
        self._authenticate_as('sungjin', 'pw123456')
        expected = {0: 'peri', 1: 'menopause', 2: 'post', 3: 'unknown'}

        for choice, stage in expected.items():
            with self.subTest(choice=choice):
                response = self.client.post(self.url, {'choice': choice}, format='json')
                self.assertEqual(response.data['stage'], stage)

    def test_answering_again_updates_instead_of_duplicating(self):
        self._authenticate_as('sungjin', 'pw123456')
        self.client.post(self.url, {'choice': 0}, format='json')

        response = self.client.post(self.url, {'choice': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stage'], 'menopause')
        self.assertEqual(MenopauseSurveyResponse.objects.filter(user=self.user).count(), 1)

    def test_rejects_choice_above_range(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.post(self.url, {'choice': 4}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_choice_below_range(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.post(self.url, {'choice': -1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_returns_saved_response(self):
        self._authenticate_as('sungjin', 'pw123456')
        self.client.post(self.url, {'choice': 2}, format='json')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['choice'], 2)
        self.assertEqual(response.data['stage'], 'post')

    def test_get_returns_404_when_not_answered_yet(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_another_users_response_does_not_leak(self):
        MenopauseSurveyResponse.objects.create(user=self.other, choice=1, stage='menopause')
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class UserConsentTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sungjin', password='pw123456')
        self.other = User.objects.create_user(username='someone-else', password='pw123456')
        self.url = reverse('users:user-consent')

    def _authenticate_as(self, username, password):
        login = self.client.post(reverse('users:login'), {
            'username': username, 'password': password,
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_new_consent_is_created_with_timestamp(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.post(self.url, {
            'face_analysis_consent': True, 'health_data_consent': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['face_analysis_consent'])
        self.assertIsNotNone(response.data['face_analysis_consented_at'])
        self.assertTrue(response.data['health_data_consent'])
        self.assertIsNotNone(response.data['health_data_consented_at'])

    def test_withdrawing_consent_clears_the_timestamp(self):
        self._authenticate_as('sungjin', 'pw123456')
        self.client.post(self.url, {'face_analysis_consent': True}, format='json')

        response = self.client.post(self.url, {'face_analysis_consent': False}, format='json')

        self.assertFalse(response.data['face_analysis_consent'])
        self.assertIsNone(response.data['face_analysis_consented_at'])

    def test_answering_again_updates_instead_of_duplicating(self):
        self._authenticate_as('sungjin', 'pw123456')
        self.client.post(self.url, {'face_analysis_consent': True}, format='json')

        response = self.client.post(self.url, {'face_analysis_consent': False}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(UserConsent.objects.filter(user=self.user).count(), 1)

    def test_sending_only_one_field_leaves_the_other_untouched(self):
        self._authenticate_as('sungjin', 'pw123456')
        self.client.post(self.url, {
            'face_analysis_consent': True, 'health_data_consent': True,
        }, format='json')

        response = self.client.post(self.url, {'face_analysis_consent': False}, format='json')

        self.assertFalse(response.data['face_analysis_consent'])
        # health_data 쪽은 이번 요청에 아예 안 보냈으니 이전 값(True)이 그대로 남아야 한다.
        self.assertTrue(response.data['health_data_consent'])
        self.assertIsNotNone(response.data['health_data_consented_at'])

    def test_get_returns_saved_consent(self):
        self._authenticate_as('sungjin', 'pw123456')
        self.client.post(self.url, {'face_analysis_consent': True}, format='json')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['face_analysis_consent'])

    def test_get_returns_404_when_no_consent_recorded_yet(self):
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_another_users_consent_does_not_leak(self):
        UserConsent.objects.create(user=self.other, face_analysis_consent=True)
        self._authenticate_as('sungjin', 'pw123456')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
