# Reauthenticate Button

## Problem
User is authenticated in the extension popup UI but gets "not authenticated" error when loading sheets. This happens when the OAuth token expires or scopes are missing.

## Solution
Added a "Reauthenticate" button that:
1. **Removes cached token** - Forces fresh authentication
2. **Requests all required scopes** - Including `spreadsheets.readonly`
3. **Shows in popup when connected** - Visible even when status is "Connected"
4. **Reloads popup after success** - Updates status automatically

## Implementation

### Button Location
- Appears below the status indicator in the popup
- Only visible when user is authenticated
- Red gradient button with refresh icon

### How It Works
1. User clicks "Reauthenticate" button
2. Extension removes cached OAuth token
3. Opens Google OAuth consent screen
4. User grants permissions
5. New token stored with all required scopes
6. Popup reloads to show updated status

### Button Styling
- Red gradient: `#ea4335` to `#c5221f`
- Full width with rounded corners
- Prominent shadow for visibility
- Refresh icon (🔄) indicates re-authentication

---

**Status**: ✅ Reauthenticate Button Added  
**Purpose**: Force fresh authentication with all required scopes

