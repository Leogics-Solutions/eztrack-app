'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  activateAutomation,
  deleteAutomation,
  getAutomation,
  getAutomationPlan,
  pauseAutomation,
  planAutomationAgentOutput,
  suggestAutomationApproval,
  suggestAutomationFields,
  updateAutomation,
  type Automation,
  type AutomationApprovalGate,
  type AutomationApprovalSuggestion,
  type AutomationAgentPlan,
  type AutomationAgentTool,
  type AutomationCapability,
  type AutomationConfig,
  type AutomationDataField,
  type AutomationFieldSuggestion,
  type AutomationFieldType,
  type AutomationPlan,
  type AutomationValidation,
} from '@/services/AutomationService';
import { listOrganizationMembers, type OrganizationMember } from '@/services/OrganizationService';
import { listSqlAccountConnections, type SqlAccountConnection } from '@/services/SqlAccountService';
import { listEmailConnections, type EmailConnection } from '@/services/EmailConnectionService';
import { getGmailConnections, type GmailConnectionInfo } from '@/services/GmailService';
import { listKnowledgeSources, type KnowledgeSource } from '@/services/KnowledgeBaseService';
import { uploadPaymentBundle } from '@/services/AgentsService';
import {
  listWhatsAppConnections,
  listWhatsAppGroups,
  setAutomationWhatsAppBindings,
  type WhatsAppBinding,
  type WhatsAppConnection,
  type WhatsAppGroup,
} from '@/services/WhatsAppService';
import { listWeChatConnections, listWeChatGroups, setAutomationWeChatBindings, type WeChatBinding, type WeChatConnection, type WeChatGroup } from '@/services/WeChatService';
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSearch,
  FlaskConical,
  GripVertical,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type SectionKey = 'source' | 'instructions' | 'workflow' | 'approval' | 'outputs' | 'test';
type WorkflowFocus = 'read' | 'process' | 'checks' | 'knowledge';

const SECTIONS = [
  ['source', 'Source', 'Where work arrives', MessageCircle],
  ['instructions', 'Instructions', 'Tell Smartdok the outcome', Sparkles],
  ['workflow', 'Review workflow', 'Read, process and check', FileSearch],
  ['approval', 'Approval', 'Human control', CheckCircle2],
  ['outputs', 'Output', 'What happens next', Send],
  ['test', 'Test & activate', 'Validate before going live', FlaskConical],
] as const;

const SOURCE_OPTIONS = [
  ['UPLOAD', 'Web & mobile upload', 'Files and combined document batches'],
  ['WHATSAPP', 'WhatsApp groups', 'Connected company WhatsApp groups'],
  ['WECHAT', 'WeChat groups', 'Personal WeChat groups through the local Windows runner'],
  ['GMAIL', 'Gmail', 'Connected Capture mailbox'],
  ['DRIVE', 'Google Drive', 'Connected watched folder'],
  ['BANK_STATEMENT', 'Bank transactions', 'Imported statements and bank feeds'],
] as const;

const KNOWLEDGE_OPTIONS = [
  ['BUSINESS_ENTITY_REGISTRY', 'Business entities & routing'],
  ['DOCUMENT_TEMPLATE', 'Company document templates'],
  ['CUSTOMER_MASTER', 'Customer master'],
  ['PRODUCT_CATALOGUE', 'Product/SKU catalogue'],
  ['ITEM_ALIASES', 'Item aliases'],
  ['TAX_CODES', 'Tax codes'],
  ['OPEN_RECEIVABLES', 'Open receivables'],
  ['INVOICE_REGISTER', 'Invoice register'],
  ['BANK_ACCOUNTS', 'Approved bank accounts'],
  ['PAYMENT_TOLERANCE_POLICY', 'Payment tolerance policy'],
] as const;

const AGENT_TOOL_OPTIONS: Array<[AutomationAgentTool, string, string]> = [
  ['KNOWLEDGE_SEARCH_ENTITIES', 'Resolve business entity', 'Search only the company registries allowed by this automation'],
  ['KNOWLEDGE_FIND_DOCUMENT_TEMPLATE', 'Find company templates', 'Select document knowledge for the resolved issuing company'],
  ['SQL_SEARCH_CUSTOMER', 'Find customer', 'Read customer master data'],
  ['SQL_SEARCH_ITEM', 'Find inventory item', 'Read stock and service items'],
  ['SQL_CHECK_DUPLICATE', 'Check duplicate PO', 'Prevent duplicate accounting records'],
  ['SQL_CREATE_DELIVERY_ORDER', 'Create Delivery Order', 'Create a DO through the approved connector'],
  ['SQL_CREATE_INVOICE_FROM_DO', 'Create Invoice from DO', 'Preserve the accounting document relationship'],
  ['SMARTDOK_RENDER_DOCUMENTS', 'Prepare customer PDFs', 'Apply the resolved company template or Smartdok standard layout'],
  ['WHATSAPP_SEND_DOCUMENTS', 'Return documents to WhatsApp', 'Send to the originating group'],
  ['SQL_LIST_OPEN_RECEIVABLES', 'Read open receivables', 'Read live invoice balances from SQL Accounting'],
  ['SQL_LIST_PAYMENT_METHODS', 'Read payment methods', 'Read approved bank and payment-method mappings'],
  ['SQL_CHECK_DUPLICATE_RECEIPT', 'Check duplicate receipt', 'Prevent duplicate ORs by bank reference and amount'],
  ['SQL_CREATE_CUSTOMER_PAYMENT', 'Create Customer Payment / OR', 'Post approved receipt allocations and knock-offs'],
  ['SQL_GET_RECEIPT_PDF', 'Retrieve official OR PDF', 'Export the official receipt from SQL Accounting'],
  ['SOURCE_SEND_DOCUMENTS', 'Return documents to source', 'Send official output files to the originating channel'],
  ['EMAIL_SEND_OUTSOURCE_REQUEST', 'Send outsourced request', 'Email the provider and recipients resolved from company knowledge'],
  ['EMAIL_WAIT_FOR_REPLY', 'Wait for email reply', 'Pause this run without blocking other work'],
  ['EMAIL_RECEIVE_DOCUMENTS', 'Receive returned documents', 'Resume the same run when reply attachments arrive'],
];

const FIELD_TYPES: AutomationFieldType[] = ['TEXT', 'NUMBER', 'MONEY', 'CURRENCY', 'DATE', 'BOOLEAN', 'ENTITY', 'OBJECT'];
const AUTOMATION_INSTRUCTION_MAX_LENGTH = 20_000;
const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const newField = (): AutomationDataField => ({ key: makeId('field'), label: 'New field', type: 'TEXT', required: false, description: '', structure: 'SCALAR', source_hint: '', confidence_threshold: 0.85, children: [] });

export default function AutomationSetupPage() {
  const router = useRouter();
  const automationId = Number(router.query.id);
  const { selectedOrganizationId } = useOrganization();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState<SectionKey>('source');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [groups, setGroups] = useState<Record<number, WhatsAppGroup[]>>({});
  const [wechatConnections, setWechatConnections] = useState<WeChatConnection[]>([]);
  const [wechatGroups, setWechatGroups] = useState<Record<number, WeChatGroup[]>>({});
  const [groupSearch, setGroupSearch] = useState<Record<number, string>>({});
  const [plan, setPlan] = useState<AutomationPlan | null>(null);
  const [instruction, setInstruction] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [showSampleText, setShowSampleText] = useState(false);
  const [design, setDesign] = useState<AutomationFieldSuggestion | null>(null);
  const [designing, setDesigning] = useState(false);
  const [workflowFocus, setWorkflowFocus] = useState<WorkflowFocus>('read');
  const [editingFields, setEditingFields] = useState(false);
  const [editingChecks, setEditingChecks] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [approvalInstruction, setApprovalInstruction] = useState('');
  const [approvalSuggestion, setApprovalSuggestion] = useState<AutomationApprovalSuggestion | null>(null);
  const [approvalDesigning, setApprovalDesigning] = useState(false);
  const [sqlConnections, setSqlConnections] = useState<SqlAccountConnection[]>([]);
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);
  const [gmailConnections, setGmailConnections] = useState<GmailConnectionInfo[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [agentPlan, setAgentPlan] = useState<AutomationAgentPlan | null>(null);
  const [agentSample, setAgentSample] = useState('{\n  "customer": "Maincell Customer",\n  "po_number": "TEST-PO-001",\n  "currency": "USD",\n  "exchange_rate": 4.25,\n  "lines": [{ "sku": "TEST-SKU", "quantity": 2, "unit_price_myr": 100 }]\n}');
  const [planningAgent, setPlanningAgent] = useState(false);
  const [paymentTestFiles, setPaymentTestFiles] = useState<File[]>([]);
  const [paymentTestMessage, setPaymentTestMessage] = useState('SLIP UPDATE\n\nCUSTOMER NAME\nRM 0.00\n\nIV-00001 - RM 0.00');

  useEffect(() => {
    if (!Number.isInteger(automationId) || automationId <= 0) return;
    let active = true;
    setLoading(true);
    getAutomation(automationId)
      .then((result) => {
        if (!active) return;
        setAutomation(result);
        setConfig(result.config);
        setName(result.name);
        setDescription(result.description || '');
        setInstruction(result.config.data_contract.instructions || '');
        setApprovalInstruction(result.config.approval.instructions || '');
        setError(null);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load automation.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [automationId, selectedOrganizationId]);

  useEffect(() => {
    if (!config?.source.sources.includes('WHATSAPP')) return;
    listWhatsAppConnections()
      .then((items) => setConnections(items.filter((item) => item.status === 'connected')))
      .catch(() => setConnections([]));
  }, [config?.source.sources, selectedOrganizationId]);

  useEffect(() => {
    if (!config?.source.sources.includes('WECHAT')) return;
    listWeChatConnections().then((items) => setWechatConnections(items.filter((item) => item.status === 'connected'))).catch(() => setWechatConnections([]));
  }, [config?.source.sources, selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    listOrganizationMembers(selectedOrganizationId)
      .then((response) => setMembers(response.data || []))
      .catch(() => setMembers([]));
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    listSqlAccountConnections().then((result) => setSqlConnections(result.connections)).catch(() => setSqlConnections([]));
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    listEmailConnections().then(setEmailConnections).catch(() => setEmailConnections([]));
    getGmailConnections().then((result) => setGmailConnections(result.connections)).catch(() => setGmailConnections([]));
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    listKnowledgeSources().then((result) => setKnowledgeSources(result.items.filter((item) => item.status === 'STORED'))).catch(() => setKnowledgeSources([]));
  }, [selectedOrganizationId]);

  const readiness = useMemo(() => {
    if (!config) return { complete: 0, total: 6 };
    const checks = [
      config.source.sources.length > 0 && (!config.source.sources.includes('WHATSAPP') || Boolean(config.source.whatsapp_bindings?.length)) && (!config.source.sources.includes('WECHAT') || Boolean(config.source.wechat_bindings?.length)),
      Boolean(config.data_contract.instructions.trim()),
      config.data_contract.fields.length > 0 && config.capabilities.some((item) => item.enabled) && config.validations.some((item) => item.enabled),
      config.approval.mode === 'AUTO_PROCESS' || config.approval.gates.some((item) => item.enabled),
      config.outputs.some((item) => item.enabled),
      Boolean(plan?.ready) || config.test.status === 'READY' || config.test.status === 'PASSED',
    ];
    return { complete: checks.filter(Boolean).length, total: checks.length };
  }, [config, plan]);

  if (loading) return <AppLayout pageName="Automation setup"><div className="p-12 text-center text-sm text-[var(--muted-foreground)]">Loading automation…</div></AppLayout>;
  if (!automation || !config) return <AppLayout pageName="Automation setup"><div className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">{error || 'Automation not found.'}</div></AppLayout>;

  const outsourceOutput = config.outputs.find((item) => item.action === 'OUTSOURCE_DOCUMENT_REQUEST');
  const emailTools: AutomationAgentTool[] = ['EMAIL_SEND_OUTSOURCE_REQUEST', 'EMAIL_WAIT_FOR_REPLY', 'EMAIL_RECEIVE_DOCUMENTS'];
  const setOutsourceEnabled = (enabled: boolean) => {
    const defaultOutput = {
      id: 'outsource_email', type: 'INTEGRATION' as const, destination: 'CONNECTED_EMAIL', action: 'OUTSOURCE_DOCUMENT_REQUEST', enabled,
      config: {
        test_mode: false,
        test_recipient: '',
        subject_template: '[Smartdok {{thread_token}}] DO & Invoice request - {{issuing_entity.legal_name}} - {{po_number}}',
        body_template: 'Hi Team,\n\nPlease prepare the Delivery Order and Sales Invoice for the attached purchase order.\n\nIssuing company: {{issuing_entity.legal_name}}\nCustomer: {{customer}}\nPO/reference: {{po_number}}\nDocument date: {{document_date}}\n\nPlease reply to this same email thread and attach the completed documents.\n\nProvider instructions:\n{{provider_instructions}}\n\nThank you.',
        expected_attachments: [
          { type: 'DELIVERY_ORDER', label: 'Delivery Order', required: true, keywords: ['delivery order', 'do'] },
          { type: 'INVOICE', label: 'Invoice', required: true, keywords: ['invoice', 'inv', 'iv'] },
        ],
        auto_return_to_source: false,
      }, mappings: [],
    };
    const outputs = outsourceOutput
      ? config.outputs.map((item) => item.action === 'OUTSOURCE_DOCUMENT_REQUEST' ? { ...item, enabled } : item)
      : [...config.outputs, defaultOutput];
    const allowed = enabled
      ? Array.from(new Set([...config.agent_output.allowed_tools, ...emailTools])) as AutomationAgentTool[]
      : config.agent_output.allowed_tools.filter((tool) => !emailTools.includes(tool));
    setConfig({ ...config, outputs, agent_output: { ...config.agent_output, allowed_tools: allowed } });
  };
  const updateOutsourceConfig = (patch: Record<string, unknown>) => setConfig({
    ...config,
    outputs: config.outputs.map((item) => item.action === 'OUTSOURCE_DOCUMENT_REQUEST'
      ? { ...item, config: { ...item.config, ...patch } }
      : item),
  });

  const save = async () => {
    if (!name.trim()) return null;
    setBusy(true); setError(null); setNotice(null);
    try {
      const saved = await updateAutomation(automation.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: config.data_contract.instructions,
        approval_required: config.approval.mode !== 'AUTO_PROCESS',
        config,
      });
      setAutomation(saved); setConfig(saved.config); setNotice('Automation saved.');
      return saved;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save automation.');
      return null;
    } finally { setBusy(false); }
  };

  const activate = async () => {
    setError(null);
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    try {
      const result = await activateAutomation(automation.id);
      setAutomation(result); setConfig(result.config); setNotice('Automation activated.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not activate automation.'); }
    finally { setBusy(false); }
  };

  const pause = async () => {
    setBusy(true);
    try {
      const result = await pauseAutomation(automation.id);
      setAutomation(result); setConfig(result.config); setNotice('Automation paused.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not pause automation.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete draft "${automation.name}"?`)) return;
    setBusy(true);
    try { await deleteAutomation(automation.id); await router.push('/automations'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete automation.'); setBusy(false); }
  };

  const loadGroups = async (connectionId: number) => {
    setBusy(true);
    try {
      const items = await listWhatsAppGroups(connectionId);
      setGroups((current) => ({ ...current, [connectionId]: items }));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load groups.'); }
    finally { setBusy(false); }
  };

  const toggleBinding = async (binding: WhatsAppBinding) => {
    const current = config.source.whatsapp_bindings || [];
    const exists = current.some((item) => item.connection_id === binding.connection_id && item.group_jid === binding.group_jid);
    const next = exists ? current.filter((item) => item.connection_id !== binding.connection_id || item.group_jid !== binding.group_jid) : [...current, binding];
    setBusy(true);
    try {
      await setAutomationWhatsAppBindings(automation.id, next);
      setConfig({ ...config, source: { ...config.source, whatsapp_bindings: next } });
      setNotice('WhatsApp groups updated.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update groups.'); }
    finally { setBusy(false); }
  };

  const loadWeChatGroups = async (connectionId: number) => {
    setBusy(true);
    try { const items = await listWeChatGroups(connectionId); setWechatGroups((current) => ({ ...current, [connectionId]: items })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load WeChat groups.'); }
    finally { setBusy(false); }
  };

  const toggleWeChatBinding = async (binding: WeChatBinding) => {
    const current = config.source.wechat_bindings || [];
    const exists = current.some((item) => item.connection_id === binding.connection_id && item.group_id === binding.group_id);
    const next = exists ? current.filter((item) => item.connection_id !== binding.connection_id || item.group_id !== binding.group_id) : [...current, binding];
    setBusy(true);
    try {
      await setAutomationWeChatBindings(automation.id, next);
      setConfig({ ...config, source: { ...config.source, sources: next.length ? Array.from(new Set([...config.source.sources, 'WECHAT'])) : config.source.sources.filter((item) => item !== 'WECHAT'), wechat_bindings: next, bundle_trigger: 'SLIP UPDATE', bundle_expiry_minutes: 30 } });
      setNotice('WeChat groups updated. A same-sender SLIP UPDATE message will close each bundle.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update WeChat groups.'); }
    finally { setBusy(false); }
  };

  const toggleSource = async (value: string) => {
    const removing = config.source.sources.includes(value);
    if (!removing) {
      setConfig({ ...config, source: { ...config.source, sources: toggle(config.source.sources, value) } });
      return;
    }
    setBusy(true);
    try {
      if (value === 'WHATSAPP' && (config.source.whatsapp_bindings || []).length) {
        await setAutomationWhatsAppBindings(automation.id, []);
      }
      if (value === 'WECHAT' && (config.source.wechat_bindings || []).length) {
        await setAutomationWeChatBindings(automation.id, []);
      }
      setConfig({ ...config, source: {
        ...config.source,
        sources: config.source.sources.filter((item) => item !== value),
        ...(value === 'WHATSAPP' ? { whatsapp_bindings: [] } : {}),
        ...(value === 'WECHAT' ? { wechat_bindings: [] } : {}),
      } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not remove ${value.toLowerCase()} from this automation.`);
    } finally { setBusy(false); }
  };

  const generateDesign = async () => {
    if (instruction.trim().length < 12) return;
    setDesigning(true); setError(null); setDesign(null);
    try {
      setDesign(await suggestAutomationFields({
        template_key: config.template_key,
        instruction: instruction.trim(),
        sample_text: sampleText.trim(),
        existing_fields: config.data_contract.fields,
        existing_knowledge_types: config.knowledge.required_types,
        existing_capabilities: config.capabilities,
        existing_validations: config.validations,
      }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not design the workflow.'); }
    finally { setDesigning(false); }
  };

  const applyDesign = () => {
    if (!design) return;
    const existingConfigs = new Map(config.capabilities.map((item) => [item.key, item.config]));
    const capabilities: AutomationCapability[] = design.capabilities.map((item) => ({ ...item, config: existingConfigs.get(item.key) || {} }));
    setConfig({
      ...config,
      data_contract: { ...config.data_contract, instructions: instruction.trim(), fields: design.fields },
      knowledge: { ...config.knowledge, required_types: design.knowledge_types },
      capabilities,
      validations: design.validations,
    });
    setDesign(null);
    setNotice('AI workflow applied to this unsaved draft. Review it before saving.');
    setSection('workflow');
  };

  const generateApproval = async () => {
    if (approvalInstruction.trim().length < 12) return;
    setApprovalDesigning(true); setError(null); setApprovalSuggestion(null);
    try {
      setApprovalSuggestion(await suggestAutomationApproval({
        template_key: config.template_key,
        instruction: approvalInstruction.trim(),
        workflow_summary: config.data_contract.instructions,
        validations: config.validations,
        outputs: config.outputs,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not design the approval policy.');
    } finally { setApprovalDesigning(false); }
  };

  const applyApprovalSuggestion = () => {
    if (!approvalSuggestion) return;
    setConfig({ ...config, approval: { mode: approvalSuggestion.mode, instructions: approvalInstruction.trim(), gates: approvalSuggestion.gates } });
    setApprovalSuggestion(null);
    setNotice('AI approval policy applied to this unsaved draft. Choose named members if required, then save.');
  };

  const validatePlan = async () => {
    setError(null);
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    try {
      const compiled = await getAutomationPlan(automation.id);
      setPlan(compiled);
      if (compiled.ready) setConfig((current) => current ? { ...current, test: { ...current.test, status: 'READY' } } : current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not compile the execution plan.'); }
    finally { setBusy(false); }
  };

  const testAgentPlan = async () => {
    let sample: Record<string, unknown>;
    try { sample = JSON.parse(agentSample) as Record<string, unknown>; }
    catch { setError('The sample transaction must be valid JSON.'); return; }
    setPlanningAgent(true); setError(null); setAgentPlan(null);
    try {
      const saved = await save();
      if (!saved) return;
      setAgentPlan(await planAutomationAgentOutput(automation.id, sample));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not plan this agent run.'); }
    finally { setPlanningAgent(false); }
  };

  const testPaymentBundle = async () => {
    if (!paymentTestFiles.length || !paymentTestMessage.trim().toUpperCase().startsWith('SLIP UPDATE')) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const run = await uploadPaymentBundle(automation.id, paymentTestFiles, paymentTestMessage.trim());
      await router.push(`/review/${run.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not upload the payment bundle.'); }
    finally { setBusy(false); }
  };

  const updateField = (index: number, field: AutomationDataField) => setConfig({ ...config, data_contract: { ...config.data_contract, fields: config.data_contract.fields.map((item, position) => position === index ? field : item) } });
  const updateValidation = (index: number, item: AutomationValidation) => setConfig({ ...config, validations: config.validations.map((current, position) => position === index ? item : current) });
  const updateGate = (index: number, gate: AutomationApprovalGate) => setConfig({ ...config, approval: { ...config.approval, gates: config.approval.gates.map((current, position) => position === index ? gate : current) } });

  return <AppLayout pageName="Automation setup"><div className="space-y-6">
    <header>
      <Link href="/automations" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Automations</Link>
      <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${automation.status === 'ACTIVE' ? 'border-emerald-300 bg-emerald-100 text-emerald-950' : 'border-amber-300 bg-amber-100 text-amber-950'}`}>{automation.status.toLowerCase()}</span><span className="text-xs text-[var(--muted-foreground)]">{automation.template_key === 'payment_knock_off' ? 'Payment knock-off' : 'PO to DO & Invoice'} · V{config.template_version}</span></div>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full bg-transparent text-2xl font-bold outline-none" />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full resize-none bg-transparent text-sm leading-6 text-[var(--muted-foreground)] outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold"><Save className="h-4 w-4" /> Save</button>
          {automation.status === 'ACTIVE' ? <button type="button" onClick={() => void pause()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white"><Pause className="h-4 w-4" /> Pause</button> : <button type="button" onClick={() => void activate()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white"><Play className="h-4 w-4" /> Activate</button>}
          {automation.status === 'DRAFT' && <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2.5 text-sm text-red-700 dark:text-red-300"><Trash2 className="h-4 w-4" /> Delete</button>}
        </div>
      </div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">{notice}</div>}
    {section === 'test' && config.template_key === 'payment_knock_off' && <PaymentShadowUploader files={paymentTestFiles} message={paymentTestMessage} busy={busy} onFiles={setPaymentTestFiles} onMessage={setPaymentTestMessage} onSubmit={() => void testPaymentBundle()} />}

    <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)_240px]">
      <nav className="h-fit space-y-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        {SECTIONS.map(([key, label, help, icon], index) => { const Icon = icon; const active = section === key; return <button key={key} type="button" onClick={() => setSection(key)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${active ? 'bg-cyan-700 text-white' : 'hover:bg-[var(--muted)]'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-white/15' : 'bg-[var(--muted)]'}`}><Icon className="h-4 w-4" /></span><span><span className="block text-sm font-medium">{index + 1}. {label}</span><span className={`block text-xs ${active ? 'text-cyan-50' : 'text-[var(--muted-foreground)]'}`}>{help}</span></span></button>; })}
      </nav>

      <main className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        {section === 'source' && <Panel title="Where should work arrive?" description="Choose the channels that start this automation. Connections remain reusable under Integrations.">
          <div className="grid gap-3 sm:grid-cols-2">{SOURCE_OPTIONS.map(([value, label, help]) => <Choice key={value} selected={config.source.sources.includes(value)} title={label} detail={help} onClick={() => void toggleSource(value)} />)}</div>
          {config.source.sources.includes('WHATSAPP') && <div className="mt-5 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50">
            <div className="flex gap-3"><Smartphone className="h-5 w-5" /><div><p className="text-sm font-semibold">Connected WhatsApp groups</p><p className="text-xs">Choose one or more groups across company connections.</p></div></div>
            <div className="mt-3 space-y-3">{connections.map((connection) => {
              const query = (groupSearch[connection.id] || '').toLowerCase();
              const visible = (groups[connection.id] || []).filter((group) => !query || group.name.toLowerCase().includes(query) || group.jid.includes(query));
              return <div key={connection.id} className="rounded-lg border border-cyan-200 bg-white/80 p-3 text-slate-950 dark:border-cyan-800 dark:bg-slate-950 dark:text-white">
                <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold">{connection.name}</p><p className="text-xs opacity-70">{connection.phone_number ? `+${connection.phone_number}` : `Connection #${connection.id}`}</p></div><button type="button" onClick={() => void loadGroups(connection.id)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Load groups</button></div>
                {groups[connection.id] && <><label className="relative mt-3 block"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" /><input value={groupSearch[connection.id] || ''} onChange={(event) => setGroupSearch((current) => ({ ...current, [connection.id]: event.target.value }))} placeholder="Search groups" className="w-full rounded-lg border bg-transparent py-2 pl-8 pr-3 text-xs" /></label><div className="mt-2 max-h-64 overflow-y-auto"><div className="grid gap-2 sm:grid-cols-2">{visible.map((group) => { const selected = (config.source.whatsapp_bindings || []).some((item) => item.connection_id === connection.id && item.group_jid === group.jid); return <button key={group.jid} type="button" onClick={() => void toggleBinding({ connection_id: connection.id, group_jid: group.jid, group_name: group.name })} className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs ${selected ? 'border-cyan-600 bg-cyan-100 dark:bg-cyan-900' : ''}`}><span>{group.name}<span className="block opacity-60">{group.participant_count} members</span></span>{selected && <Check className="h-4 w-4" />}</button>; })}</div></div></>}
              </div>;
            })}{!connections.length && <Link href="/integrations/whatsapp" className="block rounded-lg border border-dashed border-cyan-400 p-3 text-sm font-semibold">Connect WhatsApp under Integrations →</Link>}</div>
          </div>}
          {config.source.sources.includes('WECHAT') && <div className="mt-5 rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50">
            <div className="flex gap-3"><MessageCircle className="h-5 w-5" /><div><p className="text-sm font-semibold">Connected WeChat groups</p><p className="text-xs">Slip files collect by sender. A following <b>SLIP UPDATE</b> message closes the bundle; incomplete bundles expire after 30 minutes.</p></div></div>
            <div className="mt-3 space-y-3">{wechatConnections.map((connection) => {
              const query = (groupSearch[-connection.id] || '').toLowerCase();
              const visible = (wechatGroups[connection.id] || []).filter((group) => !query || group.name.toLowerCase().includes(query) || group.id.toLowerCase().includes(query));
              return <div key={connection.id} className="rounded-lg border border-cyan-200 bg-white/80 p-3 text-slate-950 dark:border-cyan-800 dark:bg-slate-950 dark:text-white">
                <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold">{connection.name}</p><p className="text-xs opacity-70">{connection.display_name || connection.account_id || `Connection #${connection.id}`}</p></div><button type="button" onClick={() => void loadWeChatGroups(connection.id)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Load groups</button></div>
                {wechatGroups[connection.id] && <><label className="relative mt-3 block"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" /><input value={groupSearch[-connection.id] || ''} onChange={(event) => setGroupSearch((current) => ({ ...current, [-connection.id]: event.target.value }))} placeholder="Search groups" className="w-full rounded-lg border bg-transparent py-2 pl-8 pr-3 text-xs" /></label><div className="mt-2 max-h-64 overflow-y-auto"><div className="grid gap-2 sm:grid-cols-2">{visible.map((group) => { const selected = (config.source.wechat_bindings || []).some((item) => item.connection_id === connection.id && item.group_id === group.id); return <button key={group.id} type="button" onClick={() => void toggleWeChatBinding({ connection_id: connection.id, group_id: group.id, group_name: group.name })} className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs ${selected ? 'border-cyan-600 bg-cyan-100 dark:bg-cyan-900' : ''}`}><span>{group.name}<span className="block opacity-60">{group.member_count} members</span></span>{selected && <Check className="h-4 w-4" />}</button>; })}</div></div></>}
              </div>;
            })}{!wechatConnections.length && <Link href="/integrations/wechat" className="block rounded-lg border border-dashed border-cyan-400 p-3 text-sm font-semibold">Connect WeChat under Integrations →</Link>}</div>
          </div>}
        </Panel>}

        {section === 'instructions' && <Panel title="Tell Smartdok what should happen" description="Describe the input, what Smartdok should understand, how it should process it, and what must be checked. Use normal business language.">
          <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50">
            <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-700 text-white"><Sparkles className="h-5 w-5" /></span><div><p className="font-semibold">One instruction for the whole workflow</p><p className="mt-1 text-xs leading-5">AI will propose what to read, which trusted Smartdok capabilities to use, what to check, and which company references may help.</p></div></div>
            <textarea value={instruction} maxLength={AUTOMATION_INSTRUCTION_MAX_LENGTH} onChange={(event) => { setInstruction(event.target.value); setConfig({ ...config, data_contract: { ...config.data_contract, instructions: event.target.value } }); }} rows={10} placeholder={config.template_key === 'payment_knock_off' ? 'When a payment arrives, identify who paid, find the invoices it covers, calculate allocations and hold unexplained differences for review.' : 'When a customer PO arrives, read the customer and every order line, translate product descriptions, match our SKUs, apply the supplied exchange-rate formula, and flag unknown items, duplicate POs or totals that do not balance.'} className="mt-4 w-full rounded-xl border border-cyan-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-cyan-600 dark:border-cyan-700 dark:bg-slate-950 dark:text-white" />
            <p className="mt-1 text-right text-xs opacity-75">{instruction.length.toLocaleString()} / {AUTOMATION_INSTRUCTION_MAX_LENGTH.toLocaleString()} characters</p>
            <button type="button" onClick={() => setShowSampleText((value) => !value)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold"><ChevronDown className={`h-3.5 w-3.5 transition ${showSampleText ? 'rotate-180' : ''}`} /> {showSampleText ? 'Hide example input' : 'Add an example input (optional)'}</button>
            {showSampleText && <><textarea value={sampleText} onChange={(event) => setSampleText(event.target.value)} rows={5} placeholder="Paste representative document text, spreadsheet headings or a WhatsApp caption. Do not paste passwords or secrets." className="mt-2 w-full rounded-xl border border-cyan-300 bg-white p-3 text-xs leading-5 text-slate-950 dark:border-cyan-700 dark:bg-slate-950 dark:text-white" /><p className="mt-1 text-xs opacity-75">The example helps generate this proposal and is not saved with the automation.</p></>}
            <button type="button" onClick={() => void generateDesign()} disabled={designing || instruction.trim().length < 12} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">{designing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Sparkles className="h-4 w-4" />} {designing ? 'Designing workflow…' : 'Design workflow with AI'}</button>
          </div>
          {design && <DesignPreview design={design} onApply={applyDesign} onDiscard={() => setDesign(null)} />}
        </Panel>}

        {section === 'workflow' && <Panel title="Review the workflow" description="Move between the stages below. Only the selected stage opens, keeping the page compact.">
          <details className="rounded-xl border border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold"><span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> Business instruction</span><span className="text-xs font-normal opacity-75">{config.data_contract.instructions ? `${config.data_contract.instructions.length.toLocaleString()} characters` : 'Not configured'}</span></summary>
            <div className="border-t border-cyan-300 p-4 dark:border-cyan-800"><p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-5">{config.data_contract.instructions || 'No instruction yet. Return to Instructions and describe the workflow.'}</p><button type="button" onClick={() => setSection('instructions')} className="mt-3 text-xs font-semibold underline">Edit instruction</button></div>
          </details>

          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <WorkflowTab active={workflowFocus === 'read'} icon={FileSearch} step="1" title="Read" count={`${config.data_contract.fields.length} fields`} onClick={() => setWorkflowFocus('read')} />
            <WorkflowTab active={workflowFocus === 'process'} icon={Bot} step="2" title="Process" count={`${config.capabilities.filter((item) => item.enabled).length} capabilities`} onClick={() => setWorkflowFocus('process')} />
            <WorkflowTab active={workflowFocus === 'checks'} icon={ShieldCheck} step="3" title="Checks" count={`${config.validations.filter((item) => item.enabled).length} rules`} onClick={() => setWorkflowFocus('checks')} />
            <WorkflowTab active={workflowFocus === 'knowledge'} icon={Database} step="Optional" title="Knowledge" count={`${config.knowledge.required_types.length} references`} onClick={() => setWorkflowFocus('knowledge')} />
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] p-4 sm:p-5">
            {workflowFocus === 'read' && <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">Read and understand</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">The information Smartdok captures from each transaction.</p></div><div className="flex gap-2"><button type="button" onClick={() => setEditingFields((value) => !value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{editingFields ? 'Done editing' : 'Edit fields'}</button><button type="button" onClick={() => { setConfig({ ...config, data_contract: { ...config.data_contract, fields: [...config.data_contract.fields, newField()] } }); setEditingFields(true); }} className="inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Add</button></div></div>
              {!editingFields ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{config.data_contract.fields.map((field) => <div key={field.key} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--muted)] px-3 py-2.5"><span className="text-sm font-medium">{field.label}</span><span className="text-xs text-[var(--muted-foreground)]">{field.structure === 'TABLE' ? `${field.children.length} columns` : field.required ? 'Required' : 'Optional'}</span></div>)}</div> : <div className="mt-4 space-y-3">{config.data_contract.fields.map((field, index) => <FieldEditor key={`${field.key}-${index}`} field={field} onChange={(next) => updateField(index, next)} onRemove={() => setConfig({ ...config, data_contract: { ...config.data_contract, fields: config.data_contract.fields.filter((_, position) => position !== index) } })} />)}</div>}
              <details className="mt-4 rounded-xl border border-[var(--border)] p-3"><summary className="cursor-pointer text-xs font-semibold">Advanced document settings</summary><label className="mt-3 block text-xs">Internal document profiles<input value={config.data_contract.document_types.join(', ')} onChange={(event) => setConfig({ ...config, data_contract: { ...config.data_contract, document_types: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) } })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" /></label></details>
            </div>}

            {workflowFocus === 'process' && <div><h3 className="font-semibold">Process the information</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Trusted Smartdok capabilities selected for this workflow.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{config.capabilities.map((capability, index) => <ToggleRow key={capability.key} checked={capability.enabled} title={capability.label} detail={capability.key.replaceAll('_', ' ')} onChange={() => setConfig({ ...config, capabilities: config.capabilities.map((item, position) => position === index ? { ...item, enabled: !item.enabled } : item) })} />)}</div><p className="mt-3 text-xs text-[var(--muted-foreground)]">AI selects from registered, tested capabilities and cannot execute arbitrary code.</p></div>}

            {workflowFocus === 'checks' && <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">Check the result</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Conditions that flag, hold or reject uncertain work.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditingChecks((value) => !value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold">{editingChecks ? 'Done editing' : 'Edit checks'}</button><button type="button" onClick={() => { setConfig({ ...config, validations: [...config.validations, { id: makeId('rule'), name: 'New business rule', kind: 'DETERMINISTIC', condition: '', instruction: '', severity: 'BLOCKING', action: 'HOLD_FOR_REVIEW', enabled: true }] }); setEditingChecks(true); }} className="rounded-lg border px-3 py-2 text-xs font-semibold">+ Rule</button><button type="button" onClick={() => { setConfig({ ...config, validations: [...config.validations, { id: makeId('ai'), name: 'New AI review policy', kind: 'AI', condition: '', instruction: '', severity: 'WARNING', action: 'HOLD_FOR_REVIEW', enabled: true }] }); setEditingChecks(true); }} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white">+ AI check</button></div></div>
              {!editingChecks ? <div className="mt-4 space-y-2">{config.validations.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"><span><span className="block text-sm font-medium">{item.name}</span><span className="text-xs text-[var(--muted-foreground)]">{item.kind === 'AI' ? 'AI judgement' : 'Business rule'} · {item.action.replaceAll('_', ' ').toLowerCase()}</span></span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.enabled ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>{item.enabled ? 'On' : 'Off'}</span></div>)}</div> : <div className="mt-4 space-y-3">{config.validations.map((item, index) => <ValidationEditor key={item.id} item={item} onChange={(next) => updateValidation(index, next)} onRemove={() => setConfig({ ...config, validations: config.validations.filter((_, position) => position !== index) })} />)}</div>}
            </div>}

            {workflowFocus === 'knowledge' && <div className="text-violet-950 dark:text-violet-100">
              <div className="flex gap-3"><Database className="h-5 w-5 shrink-0" /><div><h3 className="font-semibold">Company knowledge</h3><p className="mt-1 text-xs leading-5">Choose the facts this workflow needs, then bind the exact company sources it is allowed to use. Business-entity registries resolve the issuing company and route; document templates control customer-facing PDFs.</p></div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">{KNOWLEDGE_OPTIONS.map(([value, label]) => <Choice key={value} selected={config.knowledge.required_types.includes(value)} title={label} detail={config.knowledge.required_types.includes(value) ? 'Used by this workflow' : 'Not required'} onClick={() => setConfig({ ...config, knowledge: { ...config.knowledge, required_types: toggle(config.knowledge.required_types, value) } })} />)}</div>
              <div className="mt-5 rounded-xl border border-violet-300 bg-white/80 p-4 dark:border-violet-800 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">Allowed knowledge sources</h4><p className="mt-1 text-xs opacity-75">Only selected sources are used. Leave empty to allow all stored sources of the required types.</p></div><Link href="/knowledge-base" className="rounded-lg border border-violet-400 px-3 py-2 text-xs font-semibold">Manage Knowledge Base</Link></div>
                {knowledgeSources.length === 0 ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">No stored knowledge sources are available for this company yet.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{knowledgeSources.map((source) => {
                  const selected = config.knowledge.source_ids.includes(source.id);
                  return <button key={source.id} type="button" onClick={() => setConfig({ ...config, knowledge: { ...config.knowledge, source_ids: selected ? config.knowledge.source_ids.filter((id) => id !== source.id) : [...config.knowledge.source_ids, source.id] } })} className={`rounded-lg border p-3 text-left ${selected ? 'border-violet-600 bg-violet-50 text-violet-950 dark:bg-violet-950/50 dark:text-violet-50' : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'}`}><span className="flex items-start justify-between gap-2"><span><strong className="block text-xs">{source.title}</strong><span className="mt-1 block text-[11px] opacity-75">{source.reference_type.replaceAll('_', ' ').toLowerCase()}</span></span>{selected && <Check className="h-4 w-4 shrink-0" />}</span></button>;
                })}</div>}
              </div>
              <input value={config.knowledge.notes} onChange={(event) => setConfig({ ...config, knowledge: { ...config.knowledge, notes: event.target.value } })} placeholder="Optional usage notes, e.g. caption 'A to B' means issue on behalf of A" className="mt-4 w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs text-slate-950 dark:border-violet-800 dark:bg-slate-950 dark:text-white" />
            </div>}
          </div>
        </Panel>}

        {section === 'approval' && <Panel title="Who reviews and approves?" description="Describe the policy in normal language, then assign each decision to a company role or specific people.">
          <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-950 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-50">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">Generate approval logic with AI</p><p className="mt-1 text-xs leading-5 opacity-80">AI proposes when review is required and whether an operator or admin should handle it. You still confirm the policy and can select named members.</p></div></div>
            <textarea value={approvalInstruction} onChange={(event) => { setApprovalInstruction(event.target.value); setConfig({ ...config, approval: { ...config.approval, instructions: event.target.value } }); }} rows={4} placeholder="Example: Auto-process orders below RM5,000 only when the customer, SKU, price and stock checks pass. Send exceptions to an operator to correct. Require an admin before creating records above RM5,000 or when price variance exceeds 3%." className="mt-4 w-full rounded-xl border border-violet-300 bg-white/80 p-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-violet-500 dark:border-violet-800 dark:bg-slate-950 dark:text-white" />
            <button type="button" onClick={() => void generateApproval()} disabled={approvalDesigning || approvalInstruction.trim().length < 12} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{approvalDesigning ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Sparkles className="h-4 w-4" />}{approvalDesigning ? 'Designing policy…' : 'Generate approval policy'}</button>
          </div>

          {approvalSuggestion && <div className="mt-4 rounded-xl border border-violet-300 p-4"><p className="text-sm font-semibold">Suggested policy</p><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{approvalSuggestion.summary}</p><div className="mt-3 space-y-2">{approvalSuggestion.mode === 'AUTO_PROCESS' ? <p className="rounded-lg bg-emerald-100 p-3 text-xs text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">No human approval proposed.</p> : approvalSuggestion.gates.map((gate) => <div key={gate.id} className="rounded-lg bg-[var(--muted)] p-3 text-xs"><strong>{gate.name}</strong><span className="mt-1 block text-[var(--muted-foreground)]">When: {gate.trigger} · Assign to: {gate.approver_role}</span></div>)}</div>{approvalSuggestion.warnings.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-800 dark:text-amber-200">Warning: {warning}</p>)}<div className="mt-4 flex gap-2"><button type="button" onClick={applyApprovalSuggestion} className="rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white">Apply suggestion</button><button type="button" onClick={() => setApprovalSuggestion(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-semibold">Keep current policy</button></div></div>}

          <label className="mt-5 flex items-center justify-between rounded-xl border border-[var(--border)] p-4"><span><span className="block text-sm font-semibold">Require human approval</span><span className="block text-xs text-[var(--muted-foreground)]">Turn this off only when every valid item may continue automatically.</span></span><input type="checkbox" checked={config.approval.mode === 'POLICY_BASED'} onChange={(event) => setConfig({ ...config, approval: { ...config.approval, mode: event.target.checked ? 'POLICY_BASED' : 'AUTO_PROCESS' } })} className="h-5 w-5 accent-cyan-700" /></label>
          {config.approval.mode === 'POLICY_BASED' && <><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-[var(--muted-foreground)]">Roles follow company access: operators review work; admins approve financial actions.</p><button type="button" onClick={() => setConfig({ ...config, approval: { ...config.approval, gates: [...config.approval.gates, { id: makeId('approval'), name: 'Approve before creating records', trigger: 'ALWAYS', assignee_type: 'ROLE', approver_role: 'admin', approver_user_ids: [], fallback_role: 'admin', action: 'APPROVE_OUTPUTS', enabled: true }] } })} className="shrink-0 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white">+ Approval step</button></div><div className="mt-3 space-y-3">{config.approval.gates.map((gate, index) => <ApprovalEditor key={gate.id} gate={gate} members={members} onChange={(next) => updateGate(index, next)} onRemove={() => setConfig({ ...config, approval: { ...config.approval, gates: config.approval.gates.filter((_, position) => position !== index) } })} />)}</div></>}
        </Panel>}

        {section === 'outputs' && <Panel title="What outcome should the agent complete?" description="Give the agent a goal, connections and a restricted tool set. It decides the sequence at runtime and records every call.">
          <label className="flex items-center justify-between rounded-xl border border-[var(--border)] p-4"><span><span className="block text-sm font-semibold">Use an agent for outputs</span><span className="block text-xs text-[var(--muted-foreground)]">The agent may only use the tools enabled below.</span></span><input type="checkbox" checked={config.agent_output.enabled} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, enabled: event.target.checked } })} className="h-5 w-5 accent-cyan-700" /></label>
          {config.agent_output.enabled && <div className="mt-5 space-y-5">
            <label className="block text-sm font-semibold">Outcome instruction<textarea value={config.agent_output.outcome_instruction} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, outcome_instruction: event.target.value } })} rows={7} className="mt-2 w-full rounded-xl border border-cyan-300 bg-cyan-50/40 p-3 text-sm font-normal leading-6 outline-none focus:ring-2 focus:ring-cyan-600 dark:border-cyan-800 dark:bg-cyan-950/30" placeholder="After approval, resolve the issuing company from the selected knowledge registry, create the DO and Invoice in that company's connected accounting system, prepare customer PDFs using its selected templates, and return them to the source WhatsApp group. Never create duplicates or guess an unresolved company." /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Authority level<select value={config.agent_output.authority} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, authority: event.target.value as AutomationConfig['agent_output']['authority'] } })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"><option value="PREPARE_ONLY">Prepare actions only</option><option value="AFTER_APPROVAL">Execute after human approval</option><option value="AUTO_WITHIN_POLICY">Automatic within approval policy</option></select></label><label className="text-xs font-semibold">SQL Accounting connection<select value={config.agent_output.connection_ids.sql_account || ''} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, connection_ids: { ...config.agent_output.connection_ids, sql_account: Number(event.target.value) || 0 } } })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"><option value="">Select a connection</option>{sqlConnections.map((item) => <option key={item.id} value={item.id}>{item.name}{item.last_test_status === 'success' ? ' — connected' : ' — not tested'}</option>)}</select>{sqlConnections.length === 0 && <Link href="/integrations/sql-account" className="mt-2 inline-block text-xs text-cyan-700 underline dark:text-cyan-300">Add SQL Accounting connection</Link>}</label></div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <label className="flex items-start justify-between gap-4"><span><span className="block text-sm font-semibold">Outsourced fulfilment by email</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">When company knowledge resolves OUTSOURCED, send the original PO to the registry-defined provider, wait for a same-thread reply, and attach the returned documents to this run.</span></span><input type="checkbox" checked={Boolean(outsourceOutput?.enabled)} onChange={(event) => setOutsourceEnabled(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-cyan-700" /></label>
              {outsourceOutput?.enabled && <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
                <label className="block text-xs font-semibold">Sending mailbox<select value={outsourceOutput.config.connection_id ? `${String(outsourceOutput.config.connection_type || 'EMAIL')}:${String(outsourceOutput.config.connection_id)}` : config.agent_output.connection_ids.email ? `EMAIL:${config.agent_output.connection_ids.email}` : ''} onChange={(event) => { const [connection_type, id] = event.target.value.split(':'); updateOutsourceConfig({ connection_type: connection_type || 'EMAIL', connection_id: Number(id) || 0 }); }} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"><option value="">Select a connected mailbox</option>{gmailConnections.map((item) => <option key={`gmail-${item.id}`} value={`GMAIL:${item.id}`} disabled={!item.can_send}>{item.email} · Gmail OAuth{item.can_send ? ' — ready to send' : ' — reconnect to allow sending'}</option>)}{emailConnections.map((item) => <option key={`email-${item.id}`} value={`EMAIL:${item.id}`}>{item.name} · {item.email_address}{item.last_test_status === 'success' ? ' — connected' : ' — not tested'}</option>)}</select><span className="mt-1 block font-normal text-[var(--muted-foreground)]">The same Gmail OAuth account used for capture can send after one-time permission approval.</span>{gmailConnections.some((item) => !item.can_send) && <Link href="/capture/channels" className="mt-2 inline-block text-xs font-semibold text-amber-700 underline dark:text-amber-300">Reconnect Gmail once to allow sending</Link>}{gmailConnections.length === 0 && emailConnections.length === 0 && <Link href="/capture/channels" className="mt-2 inline-block text-xs font-semibold text-cyan-700 underline dark:text-cyan-300">Connect Gmail</Link>}</label>
                <div className={`rounded-xl border p-4 ${outsourceOutput.config.test_mode ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100' : 'border-[var(--border)]'}`}>
                  <label className="flex items-start justify-between gap-4"><span><span className="block text-sm font-semibold">Test delivery mode</span><span className="mt-1 block text-xs leading-5 opacity-80">Send every outsourced request only to the test address. Real company and provider recipients, including CC addresses, are completely suppressed.</span></span><input type="checkbox" checked={Boolean(outsourceOutput.config.test_mode)} onChange={(event) => updateOutsourceConfig({ test_mode: event.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-amber-600" /></label>
                  {Boolean(outsourceOutput.config.test_mode) && <label className="mt-4 block text-xs font-semibold">Test recipient<input type="email" value={String(outsourceOutput.config.test_recipient || '')} onChange={(event) => updateOutsourceConfig({ test_recipient: event.target.value })} placeholder="test@example.com" className="mt-1 w-full rounded-lg border border-amber-400 bg-white px-3 py-2.5 font-normal text-slate-950 dark:bg-slate-950 dark:text-white" /><span className="mt-1 block font-normal opacity-75">The subject and body will be marked TEST and will list the intended production recipients for verification.</span></label>}
                </div>
                <label className="block text-xs font-semibold">Email subject template<input value={String(outsourceOutput.config.subject_template || '')} onChange={(event) => updateOutsourceConfig({ subject_template: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal" /></label>
                <label className="block text-xs font-semibold">Email body template<textarea value={String(outsourceOutput.config.body_template || '')} onChange={(event) => updateOutsourceConfig({ body_template: event.target.value })} rows={9} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent p-3 font-normal leading-6" /></label>
                <label className="block text-xs font-semibold">Required returned documents<input value={((outsourceOutput.config.expected_attachments as Array<{ label?: string; type?: string }> | undefined) || []).map((item) => item.label || item.type).join(', ')} onChange={(event) => updateOutsourceConfig({ expected_attachments: event.target.value.split(',').map((value) => value.trim()).filter(Boolean).map((label) => ({ type: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, required: true, keywords: [label.toLowerCase()] })) })} placeholder="Delivery Order, Invoice" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal" /><span className="mt-1 block font-normal text-[var(--muted-foreground)]">The reply may contain additional files. These are the documents Smartdok expects before marking the package complete.</span></label>
              </div>}
            </div>
            <div><h3 className="text-sm font-semibold">Tools this agent may use</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Read tools inspect connected systems. Create, email and send tools produce external side effects only under the authority selected above.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{AGENT_TOOL_OPTIONS.map(([tool, label, detail]) => { const selected = config.agent_output.allowed_tools.includes(tool); return <button key={tool} type="button" onClick={() => setConfig({ ...config, agent_output: { ...config.agent_output, allowed_tools: toggle(config.agent_output.allowed_tools, tool) as AutomationAgentTool[] } })} className={`rounded-xl border p-3 text-left ${selected ? 'border-cyan-500 bg-cyan-50 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-50' : 'border-[var(--border)]'}`}><span className="flex items-start justify-between gap-2"><span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs opacity-75">{detail}</span></span>{selected && <Check className="h-4 w-4" />}</span></button>; })}</div></div>
            <div className="grid gap-3 sm:grid-cols-3"><label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-xs"><input type="checkbox" checked={config.agent_output.stop_on_uncertainty} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, stop_on_uncertainty: event.target.checked } })} /> Stop on uncertainty</label><label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-xs"><input type="checkbox" checked={config.agent_output.return_to_source} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, return_to_source: event.target.checked } })} /> Return results to source</label><label className="rounded-lg border border-[var(--border)] p-3 text-xs">Maximum tool calls<input type="number" min="1" max="30" value={config.agent_output.max_steps} onChange={(event) => setConfig({ ...config, agent_output: { ...config.agent_output, max_steps: Math.min(30, Math.max(1, Number(event.target.value))) } })} className="ml-2 w-14 rounded border bg-transparent px-1 py-0.5" /></label></div>
            <details className="rounded-xl border border-[var(--border)] p-4"><summary className="cursor-pointer text-xs font-semibold">Generated execution contract</summary><div className="mt-3 space-y-2">{config.outputs.map((output) => <div key={output.id} className="flex items-center justify-between rounded-lg bg-[var(--muted)] px-3 py-2 text-xs"><span>{output.action.replaceAll('_', ' ')}</span><span className="text-[var(--muted-foreground)]">{output.enabled ? 'available to workflow' : 'disabled'}</span></div>)}</div></details>
          </div>}
        </Panel>}

        {section === 'test' && <Panel title="Test before going live" description="Compile the instruction and reviewed workflow into the ordered plan used by runtime executors.">
          <div className="rounded-xl border border-[var(--border)] p-5"><p className="text-sm font-semibold">Setup readiness: {readiness.complete}/{readiness.total}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full bg-cyan-600" style={{ width: `${(readiness.complete / readiness.total) * 100}%` }} /></div><button type="button" onClick={() => void validatePlan()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><FlaskConical className="h-4 w-4" /> Validate workflow plan</button></div>
          {plan && <div className={`mt-4 rounded-xl border p-4 ${plan.ready ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' : 'border-red-300 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-100'}`}><p className="font-semibold">{plan.ready ? 'Workflow is ready' : 'Workflow needs changes'}</p>{plan.errors.map((item) => <p key={item} className="mt-2 text-xs">Error: {item}</p>)}{plan.warnings.map((item) => <p key={item} className="mt-2 text-xs">Warning: {item}</p>)}<ol className="mt-4 space-y-2">{plan.steps.map((step, index) => <li key={step.stage} className="rounded-lg border border-current/20 bg-white/40 p-3 text-xs dark:bg-black/10"><strong>{index + 1}. {step.label}</strong><span className="mt-1 block opacity-75">{step.items.length ? step.items.join(', ') : 'No configured items'}</span></li>)}</ol></div>}
          {config.agent_output.enabled && <div className="mt-5 rounded-xl border border-violet-300 bg-violet-50/50 p-5 dark:border-violet-800 dark:bg-violet-950/30"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-violet-700 dark:text-violet-300" /><div><h3 className="font-semibold">Test the agent’s decision</h3><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">This calls the AI planner but executes no SQL Accounting or WhatsApp tools. Use obviously fake document numbers for testing.</p></div></div><label className="mt-4 block text-xs font-semibold">Sample validated transaction<textarea value={agentSample} onChange={(event) => setAgentSample(event.target.value)} rows={9} spellCheck={false} className="mt-1 w-full rounded-xl border border-violet-300 bg-[var(--card)] p-3 font-mono text-xs outline-none dark:border-violet-800" /></label><button type="button" onClick={() => void testAgentPlan()} disabled={planningAgent || busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{planningAgent ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Bot className="h-4 w-4" />}{planningAgent ? 'Agent is planning…' : 'Plan a dry run'}</button>{agentPlan && <div className="mt-4"><p className="text-sm font-semibold">{agentPlan.summary}</p><ol className="mt-3 space-y-2">{agentPlan.steps.map((step) => <li key={`${step.sequence}-${step.tool}`} className="rounded-lg border border-violet-200 bg-white/70 p-3 text-xs text-violet-950 dark:border-violet-800 dark:bg-black/10 dark:text-violet-50"><div className="flex items-start justify-between gap-3"><strong>{step.sequence}. {step.tool.replaceAll('_', ' ')}</strong>{step.requires_approval && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">approval required</span>}</div><p className="mt-1 opacity-75">{step.purpose}</p></li>)}</ol>{agentPlan.warnings.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-800 dark:text-amber-200">Warning: {warning}</p>)}</div>}</div>}
        </Panel>}
      </main>

      <aside className="h-fit rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h2 className="font-semibold">Setup readiness</h2><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]"><div className="h-full bg-cyan-600 transition-all" style={{ width: `${(readiness.complete / readiness.total) * 100}%` }} /></div><p className="mt-2 text-xs text-[var(--muted-foreground)]">{readiness.complete} of {readiness.total} steps complete</p><div className="mt-5 space-y-2 text-xs">{[['Sources', config.source.sources.length], ['Instruction', config.data_contract.instructions.trim() ? 1 : 0], ['Workflow items', config.data_contract.fields.length + config.capabilities.filter((item) => item.enabled).length + config.validations.filter((item) => item.enabled).length], ['Approvals', config.approval.mode === 'AUTO_PROCESS' ? 1 : config.approval.gates.filter((item) => item.enabled).length], ['Outputs', config.outputs.filter((item) => item.enabled).length]].map(([label, count]) => <div key={String(label)} className="flex justify-between gap-3"><span className="text-[var(--muted-foreground)]">{label}</span><strong>{count}</strong></div>)}</div></aside>
    </div>
  </div></AppLayout>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p><div className="mt-5">{children}</div></section>; }

function PaymentShadowUploader({ files, message, busy, onFiles, onMessage, onSubmit }: { files: File[]; message: string; busy: boolean; onFiles: (files: File[]) => void; onMessage: (message: string) => void; onSubmit: () => void }) {
  const valid = files.length > 0 && message.trim().toUpperCase().startsWith('SLIP UPDATE');
  return <section className="rounded-xl border border-cyan-300 bg-cyan-50 p-5 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-50"><div className="flex gap-3"><Upload className="h-5 w-5" /><div><h2 className="font-semibold">Shadow test with a manual payment bundle</h2><p className="mt-1 text-xs leading-5">Upload all slips together and paste the exact SLIP UPDATE message. This uses the same extraction, SQL preview and Review page as WeChat, but never posts without approval.</p></div></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-xs font-semibold">Payment slips<input type="file" multiple accept="image/*,.pdf" onChange={(event) => onFiles(Array.from(event.target.files || []))} className="mt-1 block w-full rounded-lg border border-cyan-300 bg-white p-2 text-sm text-slate-950" />{files.length > 0 && <span className="mt-2 block font-normal">{files.length} file(s), preserved in this order: {files.map((file) => file.name).join(', ')}</span>}</label><label className="text-xs font-semibold">Bundle message<textarea value={message} onChange={(event) => onMessage(event.target.value)} rows={8} className="mt-1 w-full rounded-lg border border-cyan-300 bg-white p-3 font-mono text-xs text-slate-950 dark:bg-slate-950 dark:text-white" /></label></div><button type="button" onClick={onSubmit} disabled={busy || !valid} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Upload className="h-4 w-4" /> Upload & open Review</button>{!message.trim().toUpperCase().startsWith('SLIP UPDATE') && <p className="mt-2 text-xs font-semibold text-red-800 dark:text-red-200">The message must begin with SLIP UPDATE.</p>}</section>;
}

function Choice({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left ${selected ? 'border-cyan-500 bg-cyan-50 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-50' : 'border-[var(--border)] hover:border-cyan-400'}`}><div className="flex justify-between gap-3"><span><span className="block text-sm font-semibold">{title}</span><span className={`mt-1 block text-xs ${selected ? 'opacity-75' : 'text-[var(--muted-foreground)]'}`}>{detail}</span></span>{selected && <Check className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />}</div></button>; }

function ToggleRow({ checked, title, detail, onChange }: { checked: boolean; title: string; detail: string; onChange: () => void }) { return <button type="button" onClick={onChange} className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] p-4 text-left"><span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-[var(--muted-foreground)]">{detail}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-[var(--border)]'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span></button>; }

function DesignPreview({ design, onApply, onDiscard }: { design: AutomationFieldSuggestion; onApply: () => void; onDiscard: () => void }) {
  return <div className="mt-5 rounded-2xl border border-violet-300 bg-violet-50 p-5 text-violet-950 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-50">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">Proposed workflow</p><p className="mt-1 text-sm leading-6">{design.summary}</p><p className="mt-1 text-xs opacity-75">Expected input: {design.inferred_document_label}</p></div><span className="w-fit rounded-full bg-violet-200 px-2.5 py-1 text-xs font-semibold text-violet-950 dark:bg-violet-800 dark:text-violet-50">AI preview</span></div>
    <ol className="mt-4 space-y-2">{design.workflow_steps.map((step, index) => <li key={`${step}-${index}`} className="flex gap-3 rounded-lg border border-violet-200 bg-white/70 p-3 text-sm dark:border-violet-800 dark:bg-black/10"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white">{index + 1}</span><span>{step}</span></li>)}</ol>
    <div className="mt-4 grid gap-2 sm:grid-cols-4">{[['Data fields', design.fields.length], ['Capabilities', design.capabilities.length], ['Checks', design.validations.length], ['References', design.knowledge_types.length]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-violet-200 bg-white/70 p-3 dark:border-violet-800 dark:bg-black/10"><strong className="block text-lg">{value}</strong><span className="text-xs opacity-75">{label}</span></div>)}</div>
    {design.knowledge_types.length > 0 && <p className="mt-3 text-xs"><strong>Suggested knowledge:</strong> {design.knowledge_types.map((item) => item.replaceAll('_', ' ').toLowerCase()).join(', ')}</p>}
    {design.warnings.map((warning) => <p key={warning} className="mt-2 text-xs">⚠ {warning}</p>)}
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onApply} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white">Apply and review workflow</button><button type="button" onClick={onDiscard} className="rounded-lg border border-violet-400 px-4 py-2.5 text-sm font-semibold">Keep current workflow</button></div>
    <p className="mt-3 text-xs opacity-75">Applying updates this unsaved draft. Approval and output settings are not changed.</p>
  </div>;
}

function WorkflowTab({ active, icon: Icon, step, title, count, onClick }: { active: boolean; icon: typeof Bot; step: string; title: string; count: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-cyan-600 bg-cyan-700 text-white shadow-sm' : 'border-[var(--border)] hover:border-cyan-400 hover:bg-[var(--muted)]'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15' : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className={`block text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-cyan-100' : 'text-[var(--muted-foreground)]'}`}>{step === 'Optional' ? step : `Step ${step}`}</span><span className="block truncate text-sm font-semibold">{title}</span><span className={`block truncate text-xs ${active ? 'text-cyan-100' : 'text-[var(--muted-foreground)]'}`}>{count}</span></span></button>;
}

function FieldEditor({ field, onChange, onRemove }: { field: AutomationDataField; onChange: (field: AutomationDataField) => void; onRemove: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const updateChild = (index: number, child: AutomationDataField) => onChange({ ...field, children: field.children.map((item, position) => position === index ? child : item) });
  const friendlyType = field.structure === 'TABLE' ? 'Repeating list' : field.structure === 'GROUP' ? 'Group' : ({ TEXT: 'Text', NUMBER: 'Number', MONEY: 'Amount', CURRENCY: 'Currency', DATE: 'Date', BOOLEAN: 'Yes / No', ENTITY: 'Company or person', OBJECT: 'Group' } as Record<AutomationFieldType, string>)[field.type];
  return <div className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-start gap-3"><GripVertical className="mt-3 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" /><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><input value={field.label} onChange={(event) => onChange({ ...field, label: event.target.value })} placeholder="What should we capture?" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium" /><span className="w-fit rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">{friendlyType}</span><label className="flex items-center gap-2 whitespace-nowrap text-xs"><input type="checkbox" checked={field.required} onChange={(event) => onChange({ ...field, required: event.target.checked })} className="accent-cyan-700" /> Must have</label></div><input value={field.description} onChange={(event) => onChange({ ...field, description: event.target.value })} placeholder="Optional: explain what this means" className="mt-2 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs" /><button type="button" onClick={() => setAdvanced((value) => !value)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ChevronDown className={`h-3.5 w-3.5 transition ${advanced ? 'rotate-180' : ''}`} /> Technical settings</button>{advanced && <div className="mt-3 grid gap-3 rounded-xl bg-[var(--muted)] p-3 sm:grid-cols-2"><label className="text-xs font-medium">Internal field key<input value={field.key} onChange={(event) => onChange({ ...field, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-mono text-xs" /></label><label className="text-xs font-medium">Data type<select value={field.type} onChange={(event) => { const type = event.target.value as AutomationFieldType; onChange({ ...field, type, structure: type === 'OBJECT' ? (field.structure === 'SCALAR' ? 'TABLE' : field.structure) : 'SCALAR', children: type === 'OBJECT' ? field.children : [] }); }} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs">{FIELD_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>{field.type === 'OBJECT' && <label className="text-xs font-medium">Layout<select value={field.structure} onChange={(event) => onChange({ ...field, structure: event.target.value as 'TABLE' | 'GROUP' })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option value="TABLE">Repeating list / rows</option><option value="GROUP">Single grouped section</option></select></label>}<label className="text-xs font-medium">Where to look<input value={field.source_hint} onChange={(event) => onChange({ ...field, source_hint: event.target.value })} placeholder="Optional source hint" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs" /></label><label className="text-xs font-medium">Minimum confidence<input type="number" min="0" max="1" step="0.05" value={field.confidence_threshold} onChange={(event) => onChange({ ...field, confidence_threshold: Math.min(1, Math.max(0, Number(event.target.value))) })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs" /></label></div>}</div><button type="button" onClick={onRemove} aria-label={`Remove ${field.label}`} className="rounded-lg p-2 text-red-700 hover:bg-red-500/10 dark:text-red-300"><Trash2 className="h-4 w-4" /></button></div>{field.type === 'OBJECT' && <div className="ml-4 mt-4 border-l-2 border-cyan-300 pl-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">{field.structure === 'TABLE' ? 'Columns in each row' : 'Fields in this group'}</p><p className="text-xs text-[var(--muted-foreground)]">Values inside this {field.structure === 'TABLE' ? 'repeating list' : 'section'}.</p></div><button type="button" onClick={() => onChange({ ...field, children: [...field.children, newField()] })} className="shrink-0 text-xs font-semibold text-cyan-700 dark:text-cyan-300">+ Add field</button></div><div className="mt-2 space-y-2">{field.children.map((child, index) => <FieldEditor key={`${child.key}-${index}`} field={child} onChange={(next) => updateChild(index, next)} onRemove={() => onChange({ ...field, children: field.children.filter((_, position) => position !== index) })} />)}</div></div>}</div>;
}

function ValidationEditor({ item, onChange, onRemove }: { item: AutomationValidation; onChange: (item: AutomationValidation) => void; onRemove: () => void }) { return <div className="rounded-xl border border-[var(--border)] p-4"><div className="grid gap-2 sm:grid-cols-[110px_1fr_auto]"><select value={item.kind} onChange={(event) => onChange({ ...item, kind: event.target.value as 'AI' | 'DETERMINISTIC' })} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-xs"><option value="DETERMINISTIC">Rule</option><option value="AI">AI check</option></select><input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium" /><button type="button" onClick={onRemove} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>{item.kind === 'AI' ? <textarea value={item.instruction} onChange={(event) => onChange({ ...item, instruction: event.target.value })} rows={3} placeholder="What should AI decide, using which evidence?" className="mt-3 w-full rounded-lg border border-[var(--border)] bg-transparent p-3 text-xs" /> : <input value={item.condition} onChange={(event) => onChange({ ...item, condition: event.target.value })} placeholder="Condition, e.g. payment_amount > 0" className="mt-3 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-xs" />}<div className="mt-3 grid gap-2 sm:grid-cols-3"><select value={item.severity} onChange={(event) => onChange({ ...item, severity: event.target.value as AutomationValidation['severity'] })} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option>INFO</option><option>WARNING</option><option>BLOCKING</option></select><select value={item.action} onChange={(event) => onChange({ ...item, action: event.target.value as AutomationValidation['action'] })} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option>FLAG</option><option>HOLD_FOR_REVIEW</option><option>REJECT</option></select><label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"><input type="checkbox" checked={item.enabled} onChange={(event) => onChange({ ...item, enabled: event.target.checked })} /> Enabled</label></div></div>; }

function ApprovalEditor({ gate, members, onChange, onRemove }: { gate: AutomationApprovalGate; members: OrganizationMember[]; onChange: (gate: AutomationApprovalGate) => void; onRemove: () => void }) {
  const assignedMembers = gate.approver_user_ids || [];
  return <div className="rounded-xl border border-[var(--border)] p-4"><div className="flex gap-2"><input value={gate.name} onChange={(event) => onChange({ ...gate, name: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium" /><button type="button" onClick={onRemove} aria-label={`Remove ${gate.name}`} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">When is approval needed?<input value={gate.trigger} onChange={(event) => onChange({ ...gate, trigger: event.target.value })} placeholder="ALWAYS or a condition" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-xs" /></label><label className="text-xs font-medium">Decision<select value={gate.action} onChange={(event) => onChange({ ...gate, action: event.target.value as AutomationApprovalGate['action'] })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option value="REVIEW_AND_CORRECT">Review and correct</option><option value="APPROVE_OUTPUTS">Approve outputs</option></select></label><label className="text-xs font-medium">Assign by<select value={gate.assignee_type} onChange={(event) => onChange({ ...gate, assignee_type: event.target.value as AutomationApprovalGate['assignee_type'], approver_user_ids: event.target.value === 'MEMBER' ? gate.approver_user_ids : [] })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option value="ROLE">Company role</option><option value="MEMBER">Specific team members</option></select></label>{gate.assignee_type === 'ROLE' ? <label className="text-xs font-medium">Responsible role<select value={gate.approver_role} onChange={(event) => onChange({ ...gate, approver_role: event.target.value as AutomationApprovalGate['approver_role'] })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option value="operator">Operator — reviews work</option><option value="admin">Admin — approves financial actions</option><option value="uploader">Uploader — supplies information</option></select></label> : <label className="text-xs font-medium">Fallback if nobody is available<select value={gate.fallback_role} onChange={(event) => onChange({ ...gate, fallback_role: event.target.value as AutomationApprovalGate['fallback_role'] })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option value="admin">Company admins</option><option value="operator">Company operators</option><option value="uploader">Company uploaders</option></select></label>}</div>{gate.assignee_type === 'MEMBER' && <div className="mt-3"><p className="text-xs font-medium">Select one or more approvers</p><div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">{members.map((member) => { const selected = assignedMembers.includes(member.user_id); return <label key={member.user_id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs ${selected ? 'bg-cyan-100 text-cyan-950 dark:bg-cyan-950 dark:text-cyan-50' : 'hover:bg-[var(--muted)]'}`}><input type="checkbox" checked={selected} onChange={() => onChange({ ...gate, approver_user_ids: selected ? assignedMembers.filter((id) => id !== member.user_id) : [...assignedMembers, member.user_id] })} /><span><strong className="block">{member.full_name || member.email}</strong><span className="text-[var(--muted-foreground)]">{member.email} · {member.role}</span></span></label>; })}{members.length === 0 && <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">No company members found. Add them under Settings → Team & access.</p>}</div>{assignedMembers.length === 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Select at least one member before saving.</p>}</div>}<label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={gate.enabled} onChange={(event) => onChange({ ...gate, enabled: event.target.checked })} /> Enable this approval step</label></div>;
}
