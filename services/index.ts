/**
 * Services exports
 */

// Auth Service
export {
  register,
  login,
  getCurrentUser,
  changePassword,
  logout,
  getAccessToken,
} from './AuthService';

export type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  User,
  GetCurrentUserResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LogoutResponse,
} from './AuthService';

// User Service
export {
  getCurrentUser as getCurrentUserProfile,
  updateCurrentUser,
  getUserQuota,
} from './UserService';

export type {
  GetUserProfileResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  QuotaData,
  PersonalQuota,
  OrganizationQuota,
  EffectiveQuota,
  GetUserQuotaResponse,
  LegacyQuotaData,
} from './UserService';

// Invoice Service
export {
  uploadInvoice,
  uploadInvoiceViaS3,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  bulkDeleteInvoices,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  validateInvoice,
  verifyInvoice,
  addPayment,
  batchUploadInvoices,
  batchUploadInvoicesMultipart,
  batchUploadSupportingDocuments,
  getBatchJobStatus,
  getDocumentBatchJobStatus,
  listBatchJobs,
  downloadInvoiceFile,
  bulkVerifyInvoices,
  exportInvoicesCsv,
  downloadInvoicesZip,
  checkDuplicateInvoice,
  getInvoiceStatistics,
} from './InvoiceService';

export type {
  Invoice,
  InvoiceLineItem,
  BankReconciliation,
  LinkedDocument,
  UploadInvoiceResponse,
  ListInvoicesParams,
  ListInvoicesResponse,
  GetInvoiceResponse,
  UpdateInvoiceRequest,
  UpdateInvoiceResponse,
  DeleteInvoiceResponse,
  BulkDeleteInvoicesRequest,
  BulkDeleteInvoicesData,
  BulkDeleteInvoicesResponse,
  ValidateInvoiceResponse,
  VerifyInvoiceVerification,
  VerifyInvoiceData,
  VerifyInvoiceResponse,
  AddLineItemRequest,
  AddLineItemResponse,
  UpdateLineItemRequest,
  UpdateLineItemResponse,
  DeleteLineItemResponse,
  AddPaymentRequest,
  AddPaymentResponse,
  InvoicePayment,
  BatchUploadResponse,
  BatchJob,
  BatchJobStatus,
  BatchJobStatusData,
  GetBatchJobResponse,
  ListBatchJobsParams,
  BatchJobListItem,
  ListBatchJobsResponse,
  InvoiceFileDownload,
  BulkVerifyInvoicesResponse,
  ExportInvoicesRequest,
  ExportInvoicesCsvResponse,
  DownloadInvoicesZipResponse,
  CheckDuplicateInvoiceParams,
  DuplicateInvoiceInfo,
  CheckDuplicateInvoiceResponse,
  InvoiceStatisticsFilters,
  InvoiceStatisticsSummary,
  InvoiceStatisticsStatusBucket,
  InvoiceStatisticsTopVendor,
  InvoiceStatisticsCategory,
  InvoiceStatisticsMonthlyTrend,
  InvoiceStatisticsRecentActivity,
  InvoiceStatisticsData,
  InvoiceStatisticsResponse,
  InvoiceStatus,
  DocumentType,
  DocumentDirection,
} from './InvoiceService';

// Vendor Service
export {
  listVendors,
  createVendor,
  getVendor,
  updateVendor,
  deleteVendor,
} from './VendorService';

export type {
  Vendor,
  ListVendorsParams,
  ListVendorsResponse,
  CreateVendorRequest,
  CreateVendorResponse,
  GetVendorResponse,
  UpdateVendorRequest,
  UpdateVendorResponse,
  DeleteVendorResponse,
} from './VendorService';

// Organization Service
export {
  listOrganizations,
  createOrganization,
  updateOrganization,
  listOrganizationMembers,
  addOrganizationMember,
  removeOrganizationMember,
  updateMemberRole,
} from './OrganizationService';

export type {
  Organization,
  OrganizationRole,
  OrganizationMember,
  ListOrganizationsResponse,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationResponse,
  ListOrganizationMembersResponse,
  AddOrganizationMemberRequest,
  AddOrganizationMemberResponse,
  RemoveOrganizationMemberResponse,
  UpdateMemberRoleRequest,
  UpdateMemberRoleResponse,
} from './OrganizationService';

// Dashboard Service
export {
  getDashboardSummary,
} from './DashboardService';

export type {
  DashboardSummaryResponse,
  DashboardSummaryData,
  DashboardSummaryParams,
  DashboardKpis,
  DashboardCharts,
  DashboardCategoryBreakdownItem,
  DashboardVendorTotalItem,
  DashboardMonthlyTotalItem,
  DashboardStatusDistributionItem,
  DashboardActivityItem,
  DashboardVendorFilterOption,
} from './DashboardService';

// Chart of Accounts Service
export {
  listChartOfAccounts,
  listChartOfAccountsViewer,
  listChartOfAccountsGrouped,
  createChartOfAccount,
  getChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  importDefaultChartOfAccounts,
  updateDefaultCoaKeywords,
} from './ChartOfAccountsService';

export type {
  ChartOfAccount,
  COAViewerAccount,
  COAViewerSummary,
  ListChartOfAccountsParams,
  ListChartOfAccountsResponse,
  ListChartOfAccountsViewerParams,
  ListChartOfAccountsViewerResponse,
  ListChartOfAccountsGroupedParams,
  ListChartOfAccountsGroupedResponse,
  CreateChartOfAccountRequest,
  CreateChartOfAccountResponse,
  GetChartOfAccountResponse,
  UpdateChartOfAccountRequest,
  UpdateChartOfAccountResponse,
  DeleteChartOfAccountResponse,
  ImportDefaultCoaResponse,
  UpdateDefaultCoaKeywordsResponse,
} from './ChartOfAccountsService';

// Creditor Accounts Service
export {
  listCreditorAccounts,
  createCreditorAccount,
  getCreditorAccount,
  updateCreditorAccount,
  deleteCreditorAccount,
  getCreditorAccountInvoices,
} from './CreditorAccountsService';

export type {
  CreditorAccount,
  ListCreditorAccountsParams,
  ListCreditorAccountsResponse,
  CreateCreditorAccountRequest,
  CreateCreditorAccountResponse,
  GetCreditorAccountResponse,
  UpdateCreditorAccountRequest,
  UpdateCreditorAccountResponse,
  DeleteCreditorAccountResponse,
  CreditorAccountInvoice,
  ListCreditorAccountInvoicesParams,
  ListCreditorAccountInvoicesResponse,
} from './CreditorAccountsService';

// Settings Service
export {
  getSettings,
  updateSettings,
  isBusinessCentralEnabled,
  getBusinessCentralConnectionCount,
  getBusinessCentralConnections,
  enableBusinessCentral,
  disableBusinessCentral,
  testBusinessCentralConnection,
  pushInvoicesToBusinessCentral,
} from './SettingsService';

export type {
  SettingsResponse,
  IntegrationSettings,
  BusinessCentralIntegration,
  BusinessCentralConnection,
  UserInfo,
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  EnableBusinessCentralRequest,
  EnableBusinessCentralResponse,
  DisableBusinessCentralRequest,
  DisableBusinessCentralResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  PushInvoicesRequest,
  PushInvoicesResponse,
  PushInvoiceDetail,
} from './SettingsService';

// Purchase Order Service
export {
  listPurchaseOrders,
  getPurchaseOrder,
} from './PurchaseOrderService';

export type {
  ListPurchaseOrdersParams,
  ListPurchaseOrdersResponse,
  GetPurchaseOrderResponse,
  PurchaseOrder,
} from './PurchaseOrderService';

// Bank Statement Service
export {
  uploadBankStatement,
  batchUploadBankStatements,
  getBankStatementJobStatus,
  listBankStatementJobs,
  listBankStatements,
  getBankStatement,
  getStatementTransactions,
  matchInvoices,
  matchInvoicesAcrossStatements,
  createLink,
  createLinksBulk,
  getStatementLinks,
  deleteLink,
  deleteBankStatement,
  getAccountNumbers,
  reprocessTransactions,
  exportBankStatementsCsv,
  isAsyncUploadResponse,
} from './BankStatementService';

export type {
  BankStatement,
  BankTransaction,
  MatchScoreBreakdown,
  TransactionInvoiceMatch,
  TransactionMatchResult,
  TransactionInvoiceLink,
  UploadBankStatementResponse,
  UploadBankStatementAsyncResponse,
  UploadBankStatementResult,
  BatchUploadBankStatementJob,
  BatchUploadBankStatementsResponse,
  BankStatementJobStatus,
  BankStatementJob,
  GetBankStatementJobResponse,
  ListBankStatementJobsResponse,
  ListBankStatementsParams,
  ListBankStatementsResponse,
  GetBankStatementResponse,
  GetStatementTransactionsParams,
  GetStatementTransactionsResponse,
  MatchInvoicesRequest,
  MatchInvoicesResponse,
  MatchInvoicesAcrossStatementsRequest,
  MatchInvoicesAcrossStatementsResponse,
  InvoiceMatchSummary,
  InvoiceMatchedTransaction,
  StatementMatchSummary,
  StatementTransactionMatch,
  MatchedInvoiceDetail,
  SupplierStatementMatch,
  CreateLinkRequest,
  CreateLinkResponse,
  CreateLinksBulkRequest,
  CreateLinksBulkResponse,
  GetStatementLinksResponse,
  DeleteLinkResponse,
  DeleteBankStatementResponse,
  GetAccountNumbersResponse,
  ReprocessTransactionsResponse,
  ExportBankStatementsCsvResponse,
  ExportBankStatementsRequest,
} from './BankStatementService';

// Supplier Statement Service
export {
  createUploadIntent,
  confirmUpload,
  uploadSupplierStatement,
  listSupplierStatements,
  getSupplierStatement,
  getSupplierStatementLineItems,
  getSupplierNames,
  deleteSupplierStatement,
  createSupplierStatementLink,
  createSupplierStatementLinksBulk,
  getInvoiceSupplierStatementLinks,
  deleteSupplierStatementLink,
} from './SupplierStatementService';

export type {
  SupplierStatement,
  SupplierStatementLineItem,
  UploadIntentRequest,
  UploadIntentResponse,
  ConfirmUploadResponse,
  UploadSupplierStatementResponse,
  UploadSupplierStatementAsyncResponse,
  UploadSupplierStatementResult,
  ListSupplierStatementsParams,
  ListSupplierStatementsResponse,
  GetSupplierStatementResponse,
  GetSupplierStatementLineItemsParams,
  GetSupplierStatementLineItemsResponse,
  ListSupplierNamesResponse,
  DeleteSupplierStatementResponse,
  SupplierStatementInvoiceLink,
  CreateSupplierStatementLinkRequest,
  CreateSupplierStatementLinkResponse,
  CreateSupplierStatementLinksBulkRequest,
  CreateSupplierStatementLinksBulkResponse,
  GetInvoiceSupplierStatementLinksResponse,
  DeleteSupplierStatementLinkResponse,
} from './SupplierStatementService';

// Document Service
export {
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  bulkDeleteDocuments,
} from './DocumentService';

export type {
  Document,
  DocumentTypeInfo,
  StructuredFields,
  ExtractedMetadata,
  DuplicateDocument,
  ListDocumentsParams,
  ListDocumentsData,
  ListDocumentsResponse,
  GetDocumentResponse,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
  DeleteDocumentResponse,
  BulkDeleteDocumentsRequest,
  BulkDeleteDocumentsData,
  BulkDeleteDocumentsResponse,
} from './DocumentService';
