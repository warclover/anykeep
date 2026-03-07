// Mock for jose package (ESM-only, needs CJS mock for Jest)
const JWTExpired = class JWTExpired extends Error {
  constructor(message) {
    super(message);
    this.name = "JWTExpired";
    this.code = "ERR_JWT_EXPIRED";
  }
};

const JWTInvalid = class JWTInvalid extends Error {
  constructor(message) {
    super(message);
    this.name = "JWTInvalid";
    this.code = "ERR_JWT_INVALID";
  }
};

const JWSSignatureVerificationFailed =
  class JWSSignatureVerificationFailed extends Error {
    constructor(message) {
      super(message);
      this.name = "JWSSignatureVerificationFailed";
      this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
    }
  };

module.exports = {
  jwtVerify: jest.fn().mockResolvedValue({
    payload: {
      sub: "mock-user-id",
      email: "mock@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
    protectedHeader: { alg: "HS256" },
  }),
  decodeJwt: jest.fn().mockReturnValue({
    sub: "mock-user-id",
    email: "mock@example.com",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  }),
  errors: {
    JWTExpired,
    JWTInvalid,
    JWSSignatureVerificationFailed,
  },
};
