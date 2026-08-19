from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from .models import MenopauseSurveyResponse, UserConsent

User = get_user_model()


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email']
        read_only_fields = ['id']
        extra_kwargs = {'email': {'required': False}}

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        # create_user() 가 비밀번호를 해싱해서 저장한다 — User(**validated_data) 로 직접
        # 만들면 평문 그대로 들어간다.
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'date_joined']
        read_only_fields = fields


class MenopauseSurveySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenopauseSurveyResponse
        fields = ['choice', 'stage', 'answered_at']
        read_only_fields = ['stage', 'answered_at']

    def validate(self, attrs):
        # 뷰가 update_or_create()로 저장하므로(save() 를 안 거침) create()/update() 가 아니라
        # 여기서 stage 를 계산해 validated_data 에 실어 보낸다.
        attrs['stage'] = MenopauseSurveyResponse.CHOICE_TO_STAGE[attrs['choice']]
        return attrs


class UserConsentSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserConsent
        fields = [
            'face_analysis_consent', 'face_analysis_consented_at',
            'health_data_consent', 'health_data_consented_at',
        ]
        read_only_fields = ['face_analysis_consented_at', 'health_data_consented_at']

    def validate(self, attrs):
        # 항목을 아예 안 보낸 요청(부분 저장)도 지원해야 해서 attrs[...]로 바로 접근하면
        # 안 된다 — 안 보낸 필드는 attrs에 키 자체가 없어 KeyError가 난다. 보낸 필드만
        # consented_at을 같이 계산해 넣어야, update_or_create가 나머지 필드를 안 건드린다.
        if 'face_analysis_consent' in attrs:
            attrs['face_analysis_consented_at'] = timezone.now() if attrs['face_analysis_consent'] else None
        if 'health_data_consent' in attrs:
            attrs['health_data_consented_at'] = timezone.now() if attrs['health_data_consent'] else None
        return attrs
