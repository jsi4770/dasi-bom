from django.urls import path

from .views import PushSubscribeView, PushUnsubscribeView, VapidPublicKeyView

app_name = 'push'

urlpatterns = [
    path('subscribe/', PushSubscribeView.as_view(), name='subscribe'),
    path('unsubscribe/', PushUnsubscribeView.as_view(), name='unsubscribe'),
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
]
