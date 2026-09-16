process.env.NODE_ENV = "test";
process.env.AUTH_OPTIONAL = "true";
process.env.AI_MOCK = "false";
process.env.OPENAI_API_KEY = "sk-test";
process.env.STATIC_DIR = "/nonexistent-static-dir";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
