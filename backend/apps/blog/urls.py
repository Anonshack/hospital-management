from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, CommentViewSet

router = DefaultRouter()
router.register('posts', PostViewSet, basename='blog-post')
router.register('comments', CommentViewSet, basename='blog-comment')

urlpatterns = [path('', include(router.urls))]
