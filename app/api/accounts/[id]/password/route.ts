import { accountError, accountFailure, accountOk } from "@/lib/account-api";
import { getAccount, readAccountPassword } from "@/lib/accounts";
import { assertSameOrigin } from "@/lib/request";
import { accountIdSchema } from "@/lib/validation/account";

export const runtime = "nodejs";

// Explicit POST prevents link prefetching or a cached GET from exposing a password.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const id = accountIdSchema.parse((await context.params).id);
    const account = await getAccount(id);
    return account ? accountOk({ password: readAccountPassword(account) }) : accountError("NOT_FOUND", "账号不存在或已被删除。", 404);
  } catch (error) { return accountFailure(error); }
}
