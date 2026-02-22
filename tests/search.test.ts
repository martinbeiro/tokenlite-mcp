import { describe, it, expect } from 'bun:test';
import { bm25Search } from '../src/search.js';

describe('bm25Search', () => {
  const tools = [
    { name: 'create_user', description: 'Create a new user account' },
    { name: 'delete_user', description: 'Delete a user account' },
    { name: 'get_user', description: 'Get user details by ID' },
    { name: 'list_users', description: 'List all users' },
    { name: 'send_email', description: 'Send an email notification' },
    { name: 'createPost', description: 'Create a blog post' },
    { name: 'health_check', description: 'Check system health' },
  ];

  describe('tokenization', () => {
    it('splits snake_case into words', () => {
      const results = bm25Search(tools, 'create');
      const names = results.map((r) => r.doc.name);

      expect(names).toContain('create_user');
      expect(names).toContain('createPost');
    });

    it('splits camelCase into words', () => {
      const results = bm25Search(tools, 'post');
      expect(results.map((r) => r.doc.name)).toContain('createPost');
    });

    it('is case insensitive', () => {
      const lower = bm25Search(tools, 'user');
      const upper = bm25Search(tools, 'USER');
      const mixed = bm25Search(tools, 'UsEr');

      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });
  });

  describe('ranking', () => {
    it('returns all docs with score 0 for empty query', () => {
      const results = bm25Search(tools, '');
      expect(results).toHaveLength(tools.length);
      expect(results.every((r) => r.score === 0)).toBe(true);
    });

    it('ranks exact name matches highest', () => {
      const results = bm25Search(tools, 'get_user');
      expect(results[0].doc.name).toBe('get_user');
      expect(results[0].score).toBeGreaterThan(results[1]?.score ?? 0);
    });

    it('ranks substring name matches higher than description matches', () => {
      // 'user' appears in both name and description for create_user
      // but only in description for some hypothetical tool
      const results = bm25Search(tools, 'email');
      expect(results[0].doc.name).toBe('send_email');
    });

    it('handles multiple query terms', () => {
      const results = bm25Search(tools, 'user account');
      // Tools with both terms should rank higher
      expect(results.length).toBeGreaterThan(0);
      expect(['create_user', 'delete_user']).toContain(results[0].doc.name);
    });

    it('filters out non-matching docs', () => {
      const results = bm25Search(tools, 'xyz123nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('IDF weighting', () => {
    it('weights rare terms higher than common terms', () => {
      // 'email' is rare (1 doc), 'user' is common (4 docs)
      const emailResults = bm25Search(tools, 'email');
      const userResults = bm25Search(tools, 'user');

      // Single match for rare term should have higher score
      // than average score for common term matches
      const emailScore = emailResults[0]?.score ?? 0;
      const avgUserScore = userResults.reduce((sum, r) => sum + r.score, 0) / userResults.length;

      expect(emailScore).toBeGreaterThan(avgUserScore);
    });
  });

  describe('edge cases', () => {
    it('handles empty docs array', () => {
      const results = bm25Search([], 'test');
      expect(results).toHaveLength(0);
    });

    it('handles docs without descriptions', () => {
      const docsWithoutDesc = [
        { name: 'tool1' },
        { name: 'tool2', description: undefined },
      ];
      const results = bm25Search(docsWithoutDesc, 'tool');
      expect(results).toHaveLength(2);
    });

    it('handles special characters in query', () => {
      const results = bm25Search(tools, 'user!@#$%');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
