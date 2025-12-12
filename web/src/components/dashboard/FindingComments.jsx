import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Textarea,
  Avatar,
} from '@chakra-ui/react';
import { useColorModeValue } from '../ui/color-mode';
import { FiSend } from 'react-icons/fi';

export function FindingComments({ comments, onAddComment }) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit();
    }
  };

  return (
    <VStack gap={4} align="stretch">
      {/* Comment List */}
      {comments.length === 0 ? (
        <Text color={mutedColor} fontSize="sm">
          No comments yet. Be the first to add one.
        </Text>
      ) : (
        <VStack gap={3} align="stretch">
          {comments.map((comment) => (
            <Box
              key={comment.id}
              bg={bgColor}
              p={3}
              borderRadius="md"
              borderWidth="1px"
              borderColor={borderColor}
            >
              <HStack justify="space-between" mb={2}>
                <HStack>
                  <Avatar.Root size="xs">
                    <Avatar.Fallback>
                      {comment.author?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <Text fontSize="sm" fontWeight="medium">
                    {comment.author}
                  </Text>
                </HStack>
                <Text fontSize="xs" color={mutedColor}>
                  {new Date(comment.created_at).toLocaleString()}
                </Text>
              </HStack>
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {comment.content}
              </Text>
            </Box>
          ))}
        </VStack>
      )}

      {/* New Comment Input */}
      <Box>
        <Textarea
          placeholder="Add a comment... (Cmd+Enter to submit)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          resize="none"
        />
        <HStack justify="flex-end" mt={2}>
          <Button
            colorPalette="blue"
            size="sm"
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            loading={submitting}
          >
            <FiSend />
            Add Comment
          </Button>
        </HStack>
      </Box>
    </VStack>
  );
}
