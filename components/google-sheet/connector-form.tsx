"use client";

import Link from "next/link";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronRight, Database, Eye, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractSpreadsheetId } from "@/lib/google/range";
import { cn } from "@/lib/utils";
import { connectorSchema, type ConnectorInput } from "@/lib/validation/connector";

type PreviewData = { headers: string[]; rows: string[][]; rowCount: number; fieldCount: number; elapsedMs: number; range: string; truncated: boolean };
type SheetOption = { id?: number | null; title: string; index: number };
type FileOption = { id?: string | null; name?: string | null };

const defaults: ConnectorInput = {
  name: "",
  authMode: "service_account",
  spreadsheetId: "",
  sheetUrl: "",
  sheet: "",
  range: "A:Z",
  headerRow: true,
  primaryKey: "user_id",
  importMode: "upsert",
  frequency: "daily",
  scheduleTime: "03:00",
  timezone: "Asia/Shanghai",
  fieldMapping: [],
  testPassed: false,
};

const targetAliases: Record<string, string> = { id: "user_id", member_id: "user_id", userid: "user_id", mail: "email", e_mail: "email", amount: "purchase_amount" };

function suggestedTarget(source: string, index: number) {
  const normalized = source.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return targetAliases[normalized] || normalized || `custom_field_${index + 1}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error?.message || "请求失败");
  return payload.data;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-semibold text-[#a73e3e]">{message}</p> : null;
}

export function ConnectorForm({ initial, connectorId, availableModes }: { initial?: Partial<ConnectorInput>; connectorId?: string; availableModes: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [testing, setTesting] = useState(false);
  const [files, setFiles] = useState<FileOption[]>([]);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [testPassed, setTestPassed] = useState(Boolean(initial?.testPassed));
  const { register, control, handleSubmit, setValue, getValues, formState: { errors } } = useForm<ConnectorInput>({
    resolver: zodResolver(connectorSchema),
    defaultValues: { ...defaults, ...initial, testPassed: Boolean(initial?.testPassed) },
  });
  const mappings = useFieldArray({ control, name: "fieldMapping" });
  const values = useWatch({ control });
  const selectedModeAvailable = availableModes.includes(values.authMode || "service_account");
  const steps = useMemo(() => [
    { label: "认证与命名", done: Boolean(values.name && selectedModeAvailable) },
    { label: "选择表格", done: Boolean(values.spreadsheetId && values.sheet) },
    { label: "预览与映射", done: testPassed },
    { label: "保存策略", done: Boolean(values.primaryKey && values.scheduleTime) },
  ], [selectedModeAvailable, testPassed, values.name, values.primaryKey, values.scheduleTime, values.sheet, values.spreadsheetId]);

  function invalidateTest() {
    setTestPassed(false);
    setValue("testPassed", false);
    setPreview(null);
  }

  async function loadSheets(id = extractSpreadsheetId(getValues("sheetUrl"))) {
    if (!id) return toast.error("请粘贴有效的 Google Sheet 链接或 Spreadsheet ID");
    setLoadingSheets(true);
    invalidateTest();
    setValue("spreadsheetId", id, { shouldValidate: true });
    try {
      const data = await api<{ sheets: SheetOption[] }>(`/api/google/sheets?mode=${getValues("authMode")}&spreadsheetId=${encodeURIComponent(id)}`);
      setSheets(data.sheets);
      const current = getValues("sheet");
      if (!current || !data.sheets.some((item) => item.title === current)) setValue("sheet", data.sheets[0]?.title || "", { shouldValidate: true });
      toast.success(`已读取 ${data.sheets.length} 个工作表`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "读取工作表失败"); }
    finally { setLoadingSheets(false); }
  }

  async function loadFiles() {
    setLoadingFiles(true);
    try {
      const data = await api<{ files: FileOption[] }>(`/api/google/spreadsheets?mode=${getValues("authMode")}`);
      setFiles(data.files);
      if (!data.files.length) toast.info("当前账号没有可访问的 Spreadsheet");
    } catch (error) { toast.error(error instanceof Error ? error.message : "读取表格列表失败"); }
    finally { setLoadingFiles(false); }
  }

  async function testConnection() {
    const current = getValues();
    const id = current.spreadsheetId || extractSpreadsheetId(current.sheetUrl);
    if (!selectedModeAvailable) return toast.error("先在连接设置中配置所选认证方式");
    if (!id || !current.sheet) return toast.error("先读取 Spreadsheet 并选择工作表");
    setTesting(true);
    try {
      const data = await api<PreviewData>("/api/google/preview", {
        method: "POST",
        body: JSON.stringify({ mode: current.authMode, spreadsheetId: id, sheet: current.sheet, range: current.range, headerRow: current.headerRow, connectorId }),
      });
      setPreview(data);
      const previous = new Map(getValues("fieldMapping").map((item) => [item.source, item.target]));
      mappings.replace(data.headers.map((source, index) => ({ source, target: previous.get(source) || suggestedTarget(source, index) })));
      const targets = data.headers.map((source, index) => previous.get(source) || suggestedTarget(source, index));
      if (!targets.includes(getValues("primaryKey"))) setValue("primaryKey", targets[0] || "user_id");
      setTestPassed(true);
      setValue("testPassed", true);
      toast.success(`连接正常，读取到 ${data.rowCount} 行数据`);
    } catch (error) { setTestPassed(false); setValue("testPassed", false); toast.error(error instanceof Error ? error.message : "测试失败"); }
    finally { setTesting(false); }
  }

  function selectFile(fileId: string) {
    const file = files.find((item) => item.id === fileId);
    if (!file?.id) return;
    setValue("sheetUrl", `https://docs.google.com/spreadsheets/d/${file.id}/edit`, { shouldValidate: true });
    setValue("spreadsheetId", file.id, { shouldValidate: true });
    void loadSheets(file.id);
  }

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      try {
        const method = connectorId ? "PATCH" : "POST";
        const url = connectorId ? `/api/google-sheet/connectors/${connectorId}` : "/api/google-sheet/connectors";
        await api(url, { method, body: JSON.stringify({ ...data, testPassed }) });
        toast.success(connectorId ? "连接器已更新" : "连接器已创建");
        router.push("/tools/google-sheet");
        router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); }
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)_280px] lg:items-start">
      <aside className="surface p-3 lg:sticky lg:top-24">
        {steps.map((step, index) => <div key={step.label} className={cn("flex items-center gap-3 rounded-xl p-3 text-sm", step.done ? "text-[#205d40]" : "text-[#718070]")}><span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold", step.done ? "border-[#a8d7bd] bg-[#dff5e9]" : "border-[#d6dcd4] bg-white")}>{step.done ? <Check className="size-3.5" /> : index + 1}</span><span className="font-semibold">{step.label}</span></div>)}
      </aside>

      <div className="space-y-5">
        <section className="surface">
          <div className="border-b border-[#e4e8e1] p-5"><h2 className="font-bold">认证与命名</h2><p className="mt-1 text-xs text-[#748073]">选择团队已配置的共享连接。</p></div>
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div><label className="form-label" htmlFor="name">连接器名称</label><Input id="name" {...register("name")} placeholder="例如：CRM 用户标签" /><FieldError message={errors.name?.message} /></div>
            <div><label className="form-label" htmlFor="authMode">认证方式</label><select id="authMode" className="form-select" {...register("authMode", { onChange: () => { invalidateTest(); setSheets([]); } })}><option value="service_account">Service Account</option><option value="oauth">Google OAuth</option></select>{!selectedModeAvailable && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#a35728]"><AlertCircle className="size-3.5" />该认证尚未配置，<Link href="/tools/google-sheet/settings" className="underline">前往设置</Link></p>}</div>
          </div>
        </section>

        <section className="surface">
          <div className="border-b border-[#e4e8e1] p-5"><h2 className="font-bold">选择 Spreadsheet</h2><p className="mt-1 text-xs text-[#748073]">粘贴链接，或从当前共享账号可访问的表格中选择。</p></div>
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-end gap-2"><div className="min-w-[240px] flex-1"><label className="form-label" htmlFor="sheetUrl">Google Sheet 链接或 ID</label><Input id="sheetUrl" {...register("sheetUrl", { onChange: invalidateTest })} placeholder="https://docs.google.com/spreadsheets/d/.../edit" /><input type="hidden" {...register("spreadsheetId")} /><FieldError message={errors.spreadsheetId?.message} /></div><Button type="button" variant="secondary" onClick={() => loadSheets()} disabled={loadingSheets}>{loadingSheets ? <LoaderCircle className="size-4 animate-spin" /> : <Database className="size-4" />}读取工作表</Button><Button type="button" variant="ghost" onClick={loadFiles} disabled={loadingFiles || !selectedModeAvailable}>{loadingFiles && <LoaderCircle className="size-4 animate-spin" />}浏览可用表格</Button></div>
            {files.length > 0 && <div><label className="form-label" htmlFor="file-picker">可访问的 Spreadsheet</label><select id="file-picker" className="form-select" defaultValue="" onChange={(event) => selectFile(event.target.value)}><option value="">选择一个表格…</option>{files.map((file) => <option key={file.id} value={file.id || ""}>{file.name || file.id}</option>)}</select></div>}
            <div className="grid gap-5 md:grid-cols-2"><div><label className="form-label" htmlFor="sheet">工作表</label><select id="sheet" className="form-select" {...register("sheet", { onChange: invalidateTest })}><option value="">{sheets.length ? "选择工作表" : initial?.sheet || "读取链接后选择"}</option>{initial?.sheet && !sheets.some((item) => item.title === initial.sheet) && <option value={initial.sheet}>{initial.sheet}</option>}{sheets.map((sheet) => <option key={`${sheet.id}-${sheet.title}`} value={sheet.title}>{sheet.title}</option>)}</select><FieldError message={errors.sheet?.message} /></div><div><label className="form-label" htmlFor="range">数据范围</label><Input id="range" {...register("range", { onChange: invalidateTest })} placeholder="A:Z" /><p className="form-hint">预览最多读取 100 行、50 列，保存的配置仍保留原始范围。</p><FieldError message={errors.range?.message} /></div></div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#3f4c41]"><input type="checkbox" className="size-4 accent-[#3156d8]" {...register("headerRow", { onChange: invalidateTest })} />第一行是字段名</label>
            <div className="flex items-center gap-3 border-t border-[#e5e9e3] pt-5"><Button type="button" variant="primary" onClick={testConnection} disabled={testing}>{testing ? <LoaderCircle className="size-4 animate-spin" /> : <Eye className="size-4" />}测试并预览</Button>{testPassed ? <Badge variant="green"><Check className="size-3" />连接正常</Badge> : <Badge>尚未验证</Badge>}</div>
          </div>
        </section>

        <section className="surface">
          <div className="border-b border-[#e4e8e1] p-5"><h2 className="font-bold">数据预览与字段映射</h2><p className="mt-1 text-xs text-[#748073]">测试成功后按表头生成映射，你可以调整目标字段。</p></div>
          <div className="p-5">
            {preview ? <div className="mb-6 overflow-x-auto rounded-xl border border-[#dfe4dd]"><table className="min-w-full text-left text-xs"><thead className="bg-[#edf0eb] text-[#536052]"><tr>{preview.headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2.5 font-bold">{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 10).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#e5e9e3]">{preview.headers.map((header, columnIndex) => <td key={`${header}-${columnIndex}`} className="max-w-52 truncate whitespace-nowrap px-3 py-2.5">{row[columnIndex] || ""}</td>)}</tr>)}</tbody></table><div className="border-t border-[#e5e9e3] bg-white px-3 py-2 text-[11px] text-[#778376]">{preview.fieldCount} 个字段 / {preview.rowCount} 行 / {preview.elapsedMs} ms{preview.truncated ? " / 已限制预览范围" : ""}</div></div> : <div className="mb-6 grid min-h-28 place-items-center rounded-xl border border-dashed border-[#c9d0c7] text-center text-sm text-[#788477]">测试连接后显示数据预览</div>}
            <div className="space-y-2">{mappings.fields.map((field, index) => <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_36px] items-center gap-2"><Input {...register(`fieldMapping.${index}.source`)} readOnly className="bg-[#f3f5f1]" /><ChevronRight className="size-4 text-[#9aa49a]" /><Input {...register(`fieldMapping.${index}.target`)} /><Button type="button" variant="ghost" size="icon" onClick={() => mappings.remove(index)} aria-label="删除字段映射"><Trash2 className="size-4" /></Button></div>)}{mappings.fields.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => mappings.append({ source: preview?.headers[0] || "field", target: "custom_field" })}><Plus className="size-3.5" />添加映射</Button>}</div>
          </div>
        </section>

        <section className="surface">
          <div className="border-b border-[#e4e8e1] p-5"><h2 className="font-bold">导入与计划参数</h2><p className="mt-1 text-xs font-semibold text-[#946b18]">这些参数仅保存配置，当前版本不会执行自动同步。</p></div>
          <div className="grid gap-5 p-5 md:grid-cols-2"><div><label className="form-label">唯一键</label><select className="form-select" {...register("primaryKey")}>{Array.from(new Set((values.fieldMapping || []).map((item) => item.target).filter(Boolean))).map((target) => <option key={target} value={target}>{target}</option>)}{!mappings.fields.length && <option value="user_id">user_id</option>}</select></div><div><label className="form-label">导入模式</label><select className="form-select" {...register("importMode")}><option value="append">Append</option><option value="upsert">Upsert</option><option value="replace">Replace</option></select></div><div><label className="form-label">频率</label><select className="form-select" {...register("frequency")}><option value="hourly">每小时</option><option value="daily">每天</option><option value="weekly">每周</option></select></div><div><label className="form-label">执行时间</label><Input type="time" {...register("scheduleTime")} /></div><div className="md:col-span-2"><label className="form-label">时区</label><select className="form-select" {...register("timezone")}><option value="Asia/Shanghai">Asia/Shanghai</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="Asia/Seoul">Asia/Seoul</option><option value="UTC">UTC</option></select></div></div>
        </section>
      </div>

      <aside className="surface p-5 lg:sticky lg:top-24">
        <p className="text-sm font-bold">配置摘要</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-[#7a8679]">认证</dt><dd className="mt-1 font-semibold">{values.authMode === "oauth" ? "Google OAuth" : "Service Account"}</dd></div><div><dt className="text-xs text-[#7a8679]">Spreadsheet</dt><dd className="mt-1 truncate font-semibold">{values.spreadsheetId ? `${values.spreadsheetId.slice(0, 12)}…` : "—"}</dd></div><div><dt className="text-xs text-[#7a8679]">工作表 / 范围</dt><dd className="mt-1 font-semibold">{values.sheet || "—"} / {values.range || "A:Z"}</dd></div><div><dt className="text-xs text-[#7a8679]">映射字段</dt><dd className="mt-1 font-semibold">{mappings.fields.length}</dd></div><div><dt className="text-xs text-[#7a8679]">计划</dt><dd className="mt-1 font-semibold">{values.frequency || "daily"} {values.scheduleTime || "03:00"}</dd></div></dl><div className="mt-6 space-y-2 border-t border-[#e4e8e1] pt-5"><Button type="submit" variant="primary" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{connectorId ? "保存修改" : "创建连接器"}</Button><Button asChild type="button" variant="ghost" className="w-full"><Link href="/tools/google-sheet"><ArrowLeft className="size-4" />取消并返回</Link></Button></div>
      </aside>
    </form>
  );
}
