# Business Central Integration Settings - Implementation Summary

## ✅ Frontend Implementation (Completed & Corrected)

**Note:** The implementation has been updated to match the actual API response structure from `/api/v1/settings`.

### Files Created/Modified

1. **`services/SettingsService.ts`** (NEW)
   - Service for managing application settings via API
   - Functions: `getSettings()`, `updateSettings()`, `isBusinessCentralEnabled()`
   - Types: `AppSettings`, `GetSettingsResponse`, `UpdateSettingsRequest`, `UpdateSettingsResponse`

2. **`pages/settings/index.tsx`** (MODIFIED)
   - Added integrations section with Business Central toggle
   - Added state management for settings
   - Added functions to load and save settings
   - UI includes toggle switch and status messages

3. **`lib/i18n/translations/en.ts`** (MODIFIED)
   - Added `settings.integrations` section with Business Central translations

4. **`lib/i18n/translations/zh.ts`** (MODIFIED)
   - Added Chinese translations for integrations section

5. **`services/index.ts`** (MODIFIED)
   - Exported SettingsService functions and types

6. **`.env.example`** (MODIFIED)
   - Added note about settings being managed via API

## Backend Implementation Required

### 1. Settings API Endpoint

The settings endpoint returns integration status and connection information:

**GET** `/api/v1/settings`

**Response Structure:**
```json
{
  "integrations": {
    "business_central": {
      "enabled": true,
      "connection_count": 1,
      "connections": [
        {
          "id": 1,
          "environment": "production",
          "company_id": "98aae70d-7bd0-f011-8bce-7ced8d9d8de2",
          "is_active": true,
          "last_sync_at": "2024-01-20T14:30:00",
          "created_at": "2024-01-15T10:00:00"
        }
      ]
    },
    "xero": {
      "enabled": false,
      "connection_count": 0,
      "connections": []
    }
  },
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

**Note:** The `enabled` field is derived from whether at least one active connection exists. It's not a separate feature flag.

### 2. Settings Schema

```python
# app/schemas/settings.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class BusinessCentralConnection(BaseModel):
    id: int
    environment: str
    company_id: str
    is_active: bool
    last_sync_at: Optional[datetime]
    created_at: datetime

class BusinessCentralIntegration(BaseModel):
    enabled: bool  # True if at least one active connection exists
    connection_count: int
    connections: List[BusinessCentralConnection]

class IntegrationSettings(BaseModel):
    business_central: BusinessCentralIntegration
    # Add other integrations as needed
    # xero: Optional[XeroIntegration] = None

class UserInfo(BaseModel):
    id: int
    email: str
    full_name: str

class SettingsResponse(BaseModel):
    integrations: IntegrationSettings
    user: UserInfo
```

### 3. Settings Service

```python
# app/services/settings_service.py
from sqlalchemy.orm import Session
from app.models.business_central_integration import BusinessCentralConnection
from app.schemas.settings import SettingsResponse, BusinessCentralIntegration, IntegrationSettings
from typing import Optional

def get_settings(db: Session, user_id: int, organization_id: Optional[int] = None) -> SettingsResponse:
    """Get settings including integration status and connections"""
    from app.models.user import User
    
    # Get user info
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    
    # Get Business Central connections for this user/organization
    query = db.query(BusinessCentralConnection).filter(
        BusinessCentralConnection.user_id == user_id
    )
    
    if organization_id:
        query = query.filter(BusinessCentralConnection.organization_id == organization_id)
    else:
        query = query.filter(BusinessCentralConnection.organization_id.is_(None))
    
    connections = query.all()
    active_connections = [c for c in connections if c.is_active]
    
    # Build Business Central integration info
    bc_integration = BusinessCentralIntegration(
        enabled=len(active_connections) > 0,
        connection_count=len(connections),
        connections=[
            {
                "id": c.id,
                "environment": c.environment,
                "company_id": c.company_id,
                "is_active": c.is_active,
                "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in connections
        ]
    )
    
    # Build response
    return SettingsResponse(
        integrations=IntegrationSettings(
            business_central=bc_integration
        ),
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name or user.email,
        }
    )
```

### 4. Settings API Endpoint

```python
# app/api/v1/endpoints/settings.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.services.settings_service import get_settings
from app.schemas.settings import SettingsResponse

router = APIRouter()

@router.get("/settings", response_model=SettingsResponse)
async def get_app_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get application settings including integration status and connections"""
    # Get user's organization if available
    organization_id = None
    # TODO: Get organization_id from user's organization membership
    
    settings = get_settings(db, current_user.id, organization_id)
    return settings
```

**Note:** There's no PUT endpoint for settings since `enabled` is derived from connections. To enable/disable, users create or delete connections via the Business Central endpoints.

### 5. Database Migration

**Note:** No new table is needed. The settings endpoint aggregates data from existing tables:
- `business_central_connections` table (already exists from Business Central integration)
- `users` table (already exists)

The `enabled` status is computed from active connections, not stored separately.

### 6. Business Central Endpoints

The Business Central endpoints already exist. The settings endpoint provides a way to:
- Check integration status (enabled = has active connections)
- View all connections
- See connection details (environment, company_id, last_sync_at, etc.)

No changes needed to Business Central endpoints - they work independently.

## Usage

Once the backend is implemented:

1. Users can go to Settings page
2. Find the "Integrations" section
3. View Business Central integration status:
   - **Enabled** (green badge): User has at least one active connection
   - **Disabled** (gray badge): User has no active connections
4. View connection details:
   - Environment name
   - Company ID
   - Last sync timestamp
   - Active/Inactive status
5. Connection count is displayed
6. To enable: Create a connection via Business Central endpoints
7. To disable: Delete or deactivate all connections

## Testing

1. Test that settings can be retrieved via GET `/api/v1/settings`
2. Test that settings can be updated via PUT `/api/v1/settings`
3. Test that Business Central endpoints check the setting
4. Test that the UI toggle works correctly
5. Test that settings persist across sessions

## Future Enhancements

- Add organization-level settings (override user settings)
- Add more integration toggles (e.g., QuickBooks, Xero)
- Add settings for integration-specific configurations
- Add audit logging for settings changes

