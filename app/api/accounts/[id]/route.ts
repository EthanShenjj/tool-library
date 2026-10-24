import { accountError, accountFailure, accountOk } from "@/lib/account-api";
import { deleteAccount, getAccount, saveAccount } from "@/lib/accounts";
import { readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/request";
import { accountIdSchema, accountSchema } from "@/lib/validation/account";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const id = accountIdSchema.parse((await context.params).id);
    const input = accountSchema.parse(await readJson(request));
    const existing = await getAccount(id);
    if (!existing) return accountError("NOT_FOUND", "账号不存在或已被删除。", 404);
    const account = await saveAccount(input, existing);
    return account ? accountOk(account) : accountError("NOT_FOUND", "账号已被删除。", 404);
  } catch (error) { return accountFailure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const id = accountIdSchema.parse((await context.params).id);
    const deleted = await deleteAccount(id);
    return deleted ? accountOk({ removed: true }) : accountError("NOT_FOUND", "账号不存在或已被删除。", 404);
  } catch (error) { return accountFailure(error); }
}
