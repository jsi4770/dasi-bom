from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

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
