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
} from './AuthService';

// User Service
export {
  updateCurrentUser,
  getUserQuota,
} from './UserService';

export type {
  UpdateUserRequest,
  UpdateUserResponse,
  QuotaData,
  GetUserQuotaResponse,
} from './UserService';

// Invoice Service
export {
  uploadInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  addLineItem,
  updateLineItem,
  deleteLineItem,
} from './InvoiceService';

export type {
  Invoice,
  InvoiceLineItem,
  UploadInvoiceResponse,
  ListInvoicesParams,
  ListInvoicesResponse,
  GetInvoiceResponse,
  UpdateInvoiceRequest,
  UpdateInvoiceResponse,
  DeleteInvoiceResponse,
  AddLineItemRequest,
  AddLineItemResponse,
  UpdateLineItemRequest,
  UpdateLineItemResponse,
  DeleteLineItemResponse,
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

