# Yalies API Integration

## Overview

BlueBite integrates with the Yale Yalies API to fetch and display user profile information on the frontend. This provides a better user experience by showing student names and profile pictures instead of just NetIDs.

## Current Implementation

### Frontend Usage

The Yalies integration is **frontend-only** and is used to:
1. Fetch user information by NetID when orders are displayed
2. Cache user data during the session (no persistence)
3. Display formatted names ("First Last Initial") in order lists
4. Show profile pictures in expanded order details

**Important**: No user data is stored on the backend or in the database. All Yalies lookups are ephemeral and session-scoped.

## Environment Configuration

### Required Variables

Create or update `.env` in the root directory:

```env
VITE_YALIES_KEY=<your-yalies-api-key>
```

**Note**: The `VITE_` prefix is required for Vite to expose the variable to the frontend. Yalies API keys must be kept secret and never committed to version control.

## Yalies API Documentation

The Yalies API is maintained by Yale Computer Society at: https://github.com/YaleComputerSociety/Yalies/wiki/API-Documentation

### Endpoint Used

**POST `/people`** - Search Yale directory

- **Base URL**: `https://api.yalies.io/v2`
- **Authentication**: Bearer token in `Authorization` header
- **Method**: POST
- **Content-Type**: application/json

### Request Format

```json
{
  "query": "netid_to_search",
  "filters": {},
  "page": 0,
  "page_size": 10
}
```

### Response Format

```json
[
  {
    "id": 3361927,
    "netid": "ewb28",
    "upi": 25738029,
    "email": "evan.boyle@yale.edu",
    "mailbox": "evan.boyle@bulldogs.yale.edu",
    "first_name": "Evan",
    "last_name": "Boyle",
    "address": "Monroe, CT 06468-1833",
    "school": "Yale College",
    "school_code": "YC",
    "year": 2029,
    "college": "Benjamin Franklin",
    "college_code": "BF",
    "leave": false,
    "visitor": false,
    "image": "https://yalestudentphotos.s3.amazonaws.com/9fe8b21bb2267a0f45b42a8875cba768.jpg",
    "birth_month": 4,
    "birth_day": 30,
    "major": "Undeclared"
  }
]
```

**For invalid NetIDs**: Returns empty array `[]`

### Available Fields

- **Personal**: id, netid, upi, email, mailbox, address
- **Academic**: school, school_code, year, college, college_code, major
- **Status**: leave, visitor
- **Media**: image (profile picture URL)
- **Dates**: birth_month, birth_day

## Frontend Implementation

### Utility File: `src/utils/yalies.ts`

```typescript
import { yalies } from '../utils/yalies';

// Fetch single user
const user = await yalies.fetchUserByNetId('ewb28');
if (user) {
  console.log(`${user.first_name} ${user.last_name}`);
  console.log(user.image); // Profile picture URL
}
```

### Integration Points

#### 1. OrderManager Component (`src/components/OrderManager.tsx`)

- **Fetches user data** for all NetIDs in recent orders
- **Caches results** in component state (session-only)
- **Avoids redundant API calls** - only fetches uncached NetIDs
- **Fallback behavior**:
  - If user found: Display "FirstName LastInitial" (e.g., "Evan B")
  - If user not found: Display NetID as-is

#### 2. Order Display

**Order Header** (in list view):
```
Order #1  [pending]
Customer: Evan B
$25.50
```

**Order Details** (when expanded):
```
[Profile Picture: 64x64px rounded]
Evan B
ewb28

Items
...
```

## Caching Strategy

The frontend caches Yalies lookups during the session using a `Map<string, YaliesUser | null>`:

```typescript
// Only fetches uncached NetIDs
const newCache = new Map(yaliesCache);
for (const order of orders) {
  if (!newCache.has(order.netId)) {
    const user = await yalies.fetchUserByNetId(order.netId);
    newCache.set(order.netId, user);
  }
}
```

This approach:
- ✅ Minimizes API calls
- ✅ Keeps data session-scoped
- ✅ No persistence or database storage
- ✅ Clears automatically on page refresh

## Security Considerations

⚠️ **API Key Security**:
- The Yalies API key is exposed to the frontend (in `import.meta.env.VITE_YALIES_KEY`)
- This is acceptable for Yale's system since Yalies is a public directory API
- Never commit `.env` to version control
- Rotate API keys if compromised

⚠️ **User Data Privacy**:
- Only NetID is queried (public directory lookup)
- Profile pictures and names are already public via Yalies
- No additional user data is collected or stored

## Error Handling

The frontend gracefully handles:

1. **Invalid NetID** (not in Yale directory):
   - Yalies returns empty array
   - Displays NetID as fallback name
   - Shows placeholder image

2. **API Failures** (network error, 401 auth error, etc.):
   - Returns `null`
   - Logged to console for debugging
   - Falls back to NetID display
   - App continues functioning

3. **Missing Fields**:
   - Uses fallback text if fields are undefined
   - Displays placeholder image if URL missing

## Testing

### Manual Test with curl

```bash
# Test Yalies API directly
curl -X POST "https://api.yalies.io/v2/people" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ewb28",
    "filters": {},
    "page": 0,
    "page_size": 10
  }'

# Response for valid NetID:
# [{"netid":"ewb28","first_name":"Evan","last_name":"Boyle","image":"...","college":"Benjamin Franklin",...}]

# Response for invalid NetID:
# []
```

### Frontend Testing

1. **Valid NetID**: Place order with "ewb28" → Should show "Evan B" with profile picture
2. **Invalid NetID**: Place order with "invalid123" → Should show "invalid123" with placeholder
3. **Multiple Orders**: Mix valid and invalid NetIDs → Should cache correctly

## Future Enhancements

- [ ] Implement backend caching of Yalies lookups (with TTL)
- [ ] Use Yalies for student verification during order creation
- [ ] Display additional info (college, year, major) in order details
- [ ] Search/autocomplete for NetID input using Yalies
- [ ] Add optional user registration with Yalies verification

## Troubleshooting

### Getting 401 Unauthorized

**Symptom**: Network tab shows `401 Authorization "Must prepend API key with 'Bearer '"`

**Solution**:
- Verify `.env` has `VITE_YALIES_KEY=<key>` (with `VITE_` prefix)
- Restart dev server after env changes: `npm run dev`
- Check API key is correct in Yalies dashboard

### Images not loading

**Symptom**: Placeholder showing instead of profile picture

**Possible causes**:
- CORS restrictions on S3 image URLs
- User doesn't have profile picture set in Yalies
- Image URL expired or removed

**Solution**: Use placeholder image as fallback (already implemented)

### API calls too slow

**Symptom**: Order display lags when expanding many orders

**Solution**: Caching is already implemented - only first fetch for each NetID makes API call

## References

- Yalies API Docs: https://github.com/YaleComputerSociety/Yalies/wiki/API-Documentation
- Yale Computer Society: https://www.yale.edu/yics
