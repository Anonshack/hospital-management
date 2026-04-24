import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, ThumbsDown, Plus, Trash2, Edit2, Send, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { blogAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { Modal, LoadingPage, EmptyState, Spinner } from '../components/common/UI'

function Avatar({ src, name, size = 8 }) {
  if (src) return <img src={src} className={`w-${size} h-${size} rounded-full object-cover`} alt={name} />
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white font-bold text-sm`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function CommentItem({ comment, postId, user, onDelete }) {
  const [showReplies, setShowReplies] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReplyInput, setShowReplyInput] = useState(false)
  const qc = useQueryClient()

  const replyMutation = useMutation({
    mutationFn: (content) => blogAPI.comment(postId, content, comment.id),
    onSuccess: () => { qc.invalidateQueries(['blog']); setReplyText(''); setShowReplyInput(false) },
    onError: () => toast.error('Failed to reply'),
  })

  const canDelete = user?.role === 'admin' || comment.author === user?.id

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Avatar src={comment.author_avatar} name={comment.author_name} size={7} />
        <div className="flex-1">
          <div className="bg-slate-800/60 rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-primary-400">{comment.author_name}</p>
            <p className="text-sm text-slate-300 mt-0.5">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            <button onClick={() => setShowReplyInput(v => !v)} className="text-xs text-slate-500 hover:text-primary-400 transition-colors">
              Reply
            </button>
            {canDelete && (
              <button onClick={() => onDelete(comment.id)} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                Delete
              </button>
            )}
            <span className="text-xs text-slate-600">{new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
          {showReplyInput && (
            <div className="flex gap-2 mt-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="input-field text-sm py-1.5 flex-1"
                onKeyDown={e => e.key === 'Enter' && replyText.trim() && replyMutation.mutate(replyText.trim())}
              />
              <button
                onClick={() => replyText.trim() && replyMutation.mutate(replyText.trim())}
                disabled={replyMutation.isPending}
                className="btn-primary py-1.5 px-3 text-sm"
              >
                <Send size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="ml-10">
          <button onClick={() => setShowReplies(v => !v)} className="text-xs text-slate-500 hover:text-primary-400 flex items-center gap-1 mb-2">
            {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && (
            <div className="space-y-2 border-l-2 border-slate-700/50 pl-3">
              {comment.replies.map(reply => (
                <div key={reply.id} className="flex gap-2">
                  <Avatar src={reply.author_avatar} name={reply.author_name} size={6} />
                  <div className="flex-1">
                    <div className="bg-slate-800/40 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-primary-400">{reply.author_name}</p>
                      <p className="text-sm text-slate-300 mt-0.5">{reply.content}</p>
                    </div>
                    {(user?.role === 'admin' || reply.author === user?.id) && (
                      <button onClick={() => onDelete(reply.id)} className="text-xs text-slate-500 hover:text-red-400 mt-1 px-1">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PostCard({ post, user, onEdit, onDelete }) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const qc = useQueryClient()

  const likeMutation = useMutation({
    mutationFn: (value) => blogAPI.like(post.id, value),
    onSuccess: () => qc.invalidateQueries(['blog']),
  })

  const commentMutation = useMutation({
    mutationFn: (content) => blogAPI.comment(post.id, content),
    onSuccess: () => { qc.invalidateQueries(['blog']); setCommentText('') },
    onError: () => toast.error('Failed to post comment'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => blogAPI.deleteComment(id),
    onSuccess: () => qc.invalidateQueries(['blog']),
    onError: () => toast.error('Failed to delete comment'),
  })

  const canManage = user?.role === 'admin' || post.author === user?.id

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar src={post.author_avatar} name={post.author_name} size={10} />
          <div>
            <p className="font-semibold text-slate-200">{post.author_name}</p>
            <p className="text-xs text-slate-500 capitalize">{post.author_role} · {new Date(post.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1">
            <button onClick={() => onEdit(post)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
              <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(post.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div>
        <h3 className="text-lg font-bold text-white mb-2">{post.title}</h3>
        {post.image && <img src={post.image} alt={post.title} className="w-full rounded-xl object-cover max-h-64 mb-3" />}
        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t border-slate-700/50">
        <button
          onClick={() => likeMutation.mutate(1)}
          className={`flex items-center gap-1.5 text-sm transition-colors ${post.user_reaction === 1 ? 'text-primary-400' : 'text-slate-400 hover:text-primary-400'}`}
        >
          <Heart size={15} fill={post.user_reaction === 1 ? 'currentColor' : 'none'} />
          <span>{post.likes_count}</span>
        </button>
        <button
          onClick={() => likeMutation.mutate(-1)}
          className={`flex items-center gap-1.5 text-sm transition-colors ${post.user_reaction === -1 ? 'text-red-400' : 'text-slate-400 hover:text-red-400'}`}
        >
          <ThumbsDown size={15} fill={post.user_reaction === -1 ? 'currentColor' : 'none'} />
          <span>{post.dislikes_count}</span>
        </button>
        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors ml-auto"
        >
          <MessageCircle size={15} />
          <span>{post.comments_count} comments</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="space-y-3 pt-2">
          {/* Comment input */}
          <div className="flex gap-2">
            <Avatar src={null} name={user?.first_name} size={7} />
            <div className="flex-1 flex gap-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="input-field text-sm py-1.5 flex-1"
                onKeyDown={e => e.key === 'Enter' && commentText.trim() && commentMutation.mutate(commentText.trim())}
              />
              <button
                onClick={() => commentText.trim() && commentMutation.mutate(commentText.trim())}
                disabled={commentMutation.isPending}
                className="btn-primary py-1.5 px-3 text-sm"
              >
                {commentMutation.isPending ? <Spinner size={13} /> : <Send size={13} />}
              </button>
            </div>
          </div>

          {/* Comments list */}
          <div className="space-y-3">
            {post.comments?.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                user={user}
                onDelete={(id) => deleteCommentMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BlogPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [editPost, setEditPost] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', image: null })
  const [imagePreview, setImagePreview] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['blog'],
    queryFn: () => blogAPI.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => {
      const fd = new FormData()
      fd.append('title', data.title)
      fd.append('content', data.content)
      if (data.image) fd.append('image', data.image)
      return editPost ? blogAPI.update(editPost.id, fd) : blogAPI.create(fd)
    },
    onSuccess: () => {
      toast.success(editPost ? 'Post updated!' : 'Post created!')
      qc.invalidateQueries(['blog'])
      setCreateModal(false)
      setEditPost(null)
      setForm({ title: '', content: '', image: null })
      setImagePreview(null)
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save post'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => blogAPI.delete(id),
    onSuccess: () => { toast.success('Post deleted'); qc.invalidateQueries(['blog']) },
    onError: () => toast.error('Failed to delete post'),
  })

  const canCreate = ['doctor', 'admin'].includes(user?.role)

  const openEdit = (post) => {
    setEditPost(post)
    setForm({ title: post.title, content: post.content, image: null })
    setImagePreview(post.image)
    setCreateModal(true)
  }

  const posts = data?.results || data || []

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">Blog</h1>
          <p className="section-subtitle">Medical insights and health tips</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditPost(null); setForm({ title: '', content: '', image: null }); setImagePreview(null); setCreateModal(true) }} className="btn-primary">
            <Plus size={16} /> New Post
          </button>
        )}
      </div>

      {isLoading ? <LoadingPage /> : posts.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No posts yet" description={canCreate ? "Be the first to share a medical insight." : "No blog posts available yet."} />
      ) : (
        <div className="space-y-5">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); setEditPost(null) }} title={editPost ? 'Edit Post' : 'New Blog Post'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="Post title..."
            />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              className="input-field resize-none"
              rows={6}
              placeholder="Write your post content..."
            />
          </div>
          <div>
            <label className="label">Image (optional)</label>
            {imagePreview && (
              <div className="relative mb-2">
                <img src={imagePreview} className="w-full rounded-xl object-cover max-h-40" alt="preview" />
                <button onClick={() => { setImagePreview(null); setForm(f => ({ ...f, image: null })) }}
                  className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full text-white hover:bg-red-500">
                  <X size={12} />
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files[0]
                if (file) {
                  setForm(f => ({ ...f, image: file }))
                  setImagePreview(URL.createObjectURL(file))
                }
              }}
              className="input-field text-sm"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => { setCreateModal(false); setEditPost(null) }} className="btn-secondary">Cancel</button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title.trim() || !form.content.trim() || createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? <Spinner size={14} /> : (editPost ? 'Update' : 'Publish')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
