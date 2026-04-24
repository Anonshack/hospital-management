from django.db import models
from django.conf import settings


def blog_image_upload_path(instance, filename):
    import uuid
    ext = filename.split('.')[-1]
    return f'blog/{instance.id or "new"}/{uuid.uuid4().hex}.{ext}'


class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blog_posts',
    )
    title = models.CharField(max_length=300)
    content = models.TextField()
    image = models.ImageField(upload_to='blog/posts/', blank=True, null=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def likes_count(self):
        return self.likes.filter(value=1).count()

    @property
    def dislikes_count(self):
        return self.likes.filter(value=-1).count()


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blog_comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.get_full_name()} on {self.post.title}"


class Like(models.Model):
    LIKE = 1
    DISLIKE = -1
    VALUE_CHOICES = [(LIKE, 'Like'), (DISLIKE, 'Dislike')]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blog_likes')
    value = models.SmallIntegerField(choices=VALUE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['post', 'user']

    def __str__(self):
        return f"{'Like' if self.value == 1 else 'Dislike'} by {self.user.get_full_name()}"
