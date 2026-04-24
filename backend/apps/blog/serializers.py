from rest_framework import serializers
from .models import Post, Comment, Like


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'post', 'author', 'author_name', 'author_avatar',
                  'parent', 'content', 'replies', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def get_author_avatar(self, obj):
        if obj.author.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.author.avatar.url)
        return None

    def get_replies(self, obj):
        if obj.parent is None:
            qs = obj.replies.all()
            return CommentSerializer(qs, many=True, context=self.context).data
        return []


class PostSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    author_role = serializers.CharField(source='author.role', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    likes_count = serializers.ReadOnlyField()
    dislikes_count = serializers.ReadOnlyField()
    comments_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'author_name', 'author_role', 'author_avatar',
            'title', 'content', 'image', 'is_published',
            'likes_count', 'dislikes_count', 'comments_count',
            'user_reaction', 'comments', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def get_author_avatar(self, obj):
        if obj.author.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.author.avatar.url)
        return None

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_comments_count(self, obj):
        return obj.comments.filter(parent=None).count()

    def get_user_reaction(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            like = obj.likes.filter(user=request.user).first()
            return like.value if like else None
        return None

    def get_comments(self, obj):
        top_level = obj.comments.filter(parent=None)
        return CommentSerializer(top_level, many=True, context=self.context).data


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['title', 'content', 'image', 'is_published']
