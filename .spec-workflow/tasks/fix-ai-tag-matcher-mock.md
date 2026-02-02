# Fix AiTagMatcher Integration Test Mock

The integration test `src/lib/classification/strategies/modern/__tests__/ai-tag-matcher.integration.test.ts` is failing with `TypeError: data.map is not a function`.

## Analysis
The error suggests that the Supabase mock implementation is not returning an array when the code expects one (likely returning `null` or an object).

## Task
Refactor the `createMockBuilder` and `mockSupabase` implementation in the test file to correctly mimic Supabase's response structure for `select()` queries, ensuring `data` is always an array when multiple rows are expected.

## References
- `src/lib/classification/strategies/modern/ai-tag-matcher.ts` (Source code using the mock)
- `src/lib/classification/strategies/modern/__tests__/ai-tag-matcher.integration.test.ts` (Failing test)

