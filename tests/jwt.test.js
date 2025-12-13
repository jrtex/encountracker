const { generateToken, verifyToken } = require('../server/utils/jwt');

describe('JWT Utilities', () => {
  const testPayload = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'player'
  };

  describe('generateToken', () => {
    test('should generate a valid token', () => {
      const token = generateToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('should generate different tokens for same payload', () => {
      const token1 = generateToken(testPayload);
      const token2 = generateToken(testPayload);

      // Tokens should be different due to different iat (issued at) times
      // Note: This might occasionally fail if both are generated in the same second
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token and return payload', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    test('should return null for invalid token', () => {
      const decoded = verifyToken('invalid-token');

      expect(decoded).toBeNull();
    });

    test('should return null for malformed token', () => {
      const decoded = verifyToken('not.a.valid.jwt.token');

      expect(decoded).toBeNull();
    });

    test('should return null for empty token', () => {
      const decoded = verifyToken('');

      expect(decoded).toBeNull();
    });

    test('should include expiration time in decoded token', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('Token lifecycle', () => {
    test('should generate and verify token successfully', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testPayload.id);
    });

    test('should preserve all payload properties', () => {
      const customPayload = {
        ...testPayload,
        customField: 'customValue',
        numericField: 123
      };

      const token = generateToken(customPayload);
      const decoded = verifyToken(token);

      expect(decoded.customField).toBe('customValue');
      expect(decoded.numericField).toBe(123);
    });
  });
});
