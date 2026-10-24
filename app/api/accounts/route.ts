import { accountFailure, accountOk } from "@/lib/account-api";
import { listAccounts, saveAccount } from "@/lib/accounts";
import { readJson } from "@/lib/api";
import { assertSameOrigin } from "@/lib/request";
import { accountSchema } from "@/lib/validation/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return accountOk({ accounts: await listAccounts() }); }
  catch (error) { return accountFailure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = accountSchema.parse(await readJson(request));
    return accountOk(await saveAccount(input), 201);
  } catch (error) { return accountFailure(error); }
}
