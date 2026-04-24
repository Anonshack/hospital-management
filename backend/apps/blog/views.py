from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.users.models import User
from .models import Post, Comment, Like
from .serializers import PostSerializer, PostCreateSerializer, CommentSerializer


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related('author').prefetch_related('comments__replies', 'likes').all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        base = Post.objects.select_related('author').prefetch_related('comments__replies', 'likes')
        if user.role == User.Role.ADMIN:
            return base.all().order_by('-created_at')
        return base.filter(is_published=True).order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PostCreateSerializer
        return PostSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in [User.Role.DOCTOR, User.Role.ADMIN]:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only doctors and admins can create blog posts.")
        serializer.save(author=user, is_published=True)

    def update(self, request, *args, **kwargs):
        post = self.get_object()
        user = request.user
        if user.role != User.Role.ADMIN and post.author != user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        user = request.user
        if user.role != User.Role.ADMIN and post.author != user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        post = self.get_object()
        value = request.data.get('value', 1)
        if value not in [1, -1]:
            return Response({'error': 'Value must be 1 (like) or -1 (dislike).'}, status=status.HTTP_400_BAD_REQUEST)

        like, created = Like.objects.get_or_create(post=post, user=request.user, defaults={'value': value})
        if not created:
            if like.value == value:
                like.delete()
                return Response({'message': 'Reaction removed.', 'likes': post.likes_count, 'dislikes': post.dislikes_count})
            like.value = value
            like.save()

        return Response({'message': 'Reaction saved.', 'likes': post.likes_count, 'dislikes': post.dislikes_count})

    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        post = self.get_object()
        content = request.data.get('content', '').strip()
        parent_id = request.data.get('parent')
        if not content:
            return Response({'error': 'Content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        parent = None
        if parent_id:
            try:
                parent = Comment.objects.get(id=parent_id, post=post)
            except Comment.DoesNotExist:
                return Response({'error': 'Parent comment not found.'}, status=status.HTTP_404_NOT_FOUND)

        comment = Comment.objects.create(post=post, author=request.user, content=content, parent=parent)
        return Response(CommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.select_related('author').all()
    permission_classes = [IsAuthenticated]
    serializer_class = CommentSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user.role != User.Role.ADMIN and comment.author != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user.role != User.Role.ADMIN and comment.author != request.user:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
