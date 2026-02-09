# Frontend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Authentication & Routing](#authentication--routing)
6. [Core Components](#core-components)
7. [Chat Interface](#chat-interface)
8. [State Management](#state-management)
9. [User Flows](#user-flows)
10. [API Integration](#api-integration)
11. [Styling & UI](#styling--ui)

---

## Overview

The elderlyui frontend is a Next.js 14 application built with React and TypeScript, providing a simplified interface for elderly users to interact with an AI assistant. The application uses face verification for authentication and supports both text and speech-to-speech communication.

### Key Features

- **Face-Based Authentication**: Camera-based face verification for secure login
- **Speech-to-Speech Chat**: Voice recording with automatic transcription and audio responses
- **Text Chat**: Traditional text-based messaging interface
- **Activity-Based Session Management**: Automatic logout after 15 minutes of inactivity
- **Responsive Design**: Mobile-first design optimized for elderly users
- **Real-time Audio Playback**: Automatic audio response playback for speech interactions

---

## Architecture

### Application Structure

```
┌────────────────────────────────────────────────────────────┐
│                    Next.js App Router                      │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Login      │  │   Chat       │                        │
│  │   Page       │  │   Page       │                        │
│  │              │  │   (Protected)│                        │
│  │  - Phone     │  │              │                        │
│  │    Input     │  │  - Messages  │                        │
│  │  - Face      │  │  - Text Input│                        │
│  │    Verify    │  │  - Mic Record│                        │
│  └──────────────┘  └──────────────┘                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              State Management                        │  │
│  │  - ElderlyAuthContext (Auth & Session)               │  │
│  │  - Local Storage (Token & Activity)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Component Event Handler
2. **Event Handler** → API Call (with JWT token)
3. **API Response** → Update State
4. **State Update** → Component Re-render
5. **Activity Refresh** → Update token activity timestamp

---

## Technology Stack

### Core Technologies

- **Next.js 14**: React framework with App Router
- **React 19**: UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework

### Key Libraries

- **next/image**: Optimized image component
- **next/navigation**: Client-side navigation
- **localStorage**: Client-side token and activity storage
- **fetch API**: HTTP requests
- **MediaRecorder API**: Audio recording for speech-to-speech

### Development Tools

- **ESLint**: Code linting
- **TypeScript Compiler**: Type checking

---

## Project Structure

```
app/
├── page.tsx                    # Login page (face verification)
├── layout.tsx                  # Root layout
├── globals.css                 # Global styles
│
├── chat/
│   └── page.tsx               # Chat interface page
│
├── components/
│   ├── ElderlyProtectedRoute.tsx    # Route protection wrapper
│   ├── FetchHeaderProvider.tsx       # Fetch header context provider
│   └── Notification.tsx              # Toast notification component
│
└── contexts/
    └── ElderlyAuthContext.tsx         # Authentication context
```

---

## Authentication & Routing

### Protected Routes

**Component**: `app/components/ElderlyProtectedRoute.tsx`

**Purpose**: Wraps protected pages to ensure user is authenticated.

**Technical Flow**:

1. Check for JWT token in context
2. If no token: Redirect to `/` (login page)
3. If token exists: Render children
4. Show loading spinner during verification

**Usage**:

```tsx
<ElderlyProtectedRoute>
  <ChatContent />
</ElderlyProtectedRoute>
```

### Authentication Flow

```
1. User visits / (login page)
2. User enters phone number OR uses existing token
3. If phone number:
   - Frontend sends POST /getelderlydetails
   - Backend returns elderly details
   - Frontend starts camera
4. User captures face image
5. Frontend sends POST /verify_elderly_face with image
6. Backend verifies face and returns JWT token
7. Frontend stores token in localStorage and context
8. Frontend redirects to /chat
9. Chat page checks token via ElderlyProtectedRoute
10. If valid: Render chat interface
11. If invalid: Redirect to /
```

### Token Management

- **Storage**: `localStorage.getItem('elderlyToken')`
- **Headers**: `Authorization: Bearer ${token}` (via fetch)
- **Expiration**: 24 hours maximum, 15 minutes inactivity window
- **Activity Refresh**: Called on user interactions (typing, scrolling)
- **Logout**: Clear token from context and localStorage (except expired token for detection)

### Activity-Based Session

- **Last Activity**: Tracked in `localStorage` and context state
- **Inactivity Window**: 15 minutes
- **Warning**: Shown at 14 minutes of inactivity
- **Auto-logout**: Triggered at 15 minutes inactivity or 24 hours token age
- **Refresh Endpoint**: `POST /refresh_elderly_activity`

---

## Core Components

### ElderlyProtectedRoute

**Location**: `app/components/ElderlyProtectedRoute.tsx`

**Purpose**: Protects routes requiring authentication.

**Props**: `children: React.ReactNode`

**Behavior**:

- Checks `isAuthenticated` and `token` from context
- Redirects to `/` if not authenticated
- Shows loading spinner during verification

### Notification

**Location**: `app/components/Notification.tsx`

**Purpose**: Displays toast-style notifications.

**Props**:

- `message: string` - Notification message
- `warning?: boolean` - Warning style (optional)

**Usage**: Used for error messages and logout warnings.

### ElderlyAuthContext

**Location**: `app/contexts/ElderlyAuthContext.tsx`

**Purpose**: Manages authentication state and session activity.

**State Variables**:

- `token: string | null` - JWT token
- `elderlyData: ElderlyData | null` - User data
- `isAuthenticated: boolean` - Authentication status
- `lastActivity: Date | null` - Last activity timestamp
- `logoutWarning: string | null` - Warning message before logout

**Functions**:

- `login(token, data)` - Store token and user data
- `logout()` - Clear authentication state
- `refreshActivity()` - Refresh token activity timestamp

**Activity Monitoring**:

- Checks inactivity every 10 seconds
- Shows warning at 14 minutes
- Auto-logout at 15 minutes or 24 hours

---

## Chat Interface

### Chat Page

**Location**: `app/chat/page.tsx`

**Purpose**: Main chat interface for elderly users.

**Features**:

- Message display (user/assistant)
- Text input with auto-resize
- Speech-to-speech recording (microphone button)
- Audio playback for assistant responses
- Auto-scroll to latest message
- Activity refresh on user interactions

**Speech-to-Speech Flow**:

1. User clicks microphone button
2. Browser requests microphone permission
3. MediaRecorder starts recording
4. User stops recording
5. Audio blob sent to `/speech_to_speech`
6. Backend returns `job_id`, transcript, and `language_code`
7. Frontend displays transcript immediately
8. Frontend polls `/speech_to_speech/status/{job_id}`
9. When complete, backend returns `localized_text` and `audio_base64`
10. Frontend displays assistant message
11. Audio auto-plays when response received

**Text Chat Flow**:

1. User types message
2. User presses Enter or clicks send button
3. Frontend sends POST `/chat/elderly` with text and sessionId
4. Backend processes and returns response
5. Frontend displays assistant message
6. Activity refreshed automatically

**State Variables**:

- `messages: Message[]` - Chat messages array
- `inputText: string` - Current input text
- `isLoading: boolean` - Loading state
- `isRecording: boolean` - Recording state
- `isProcessingAudio: boolean` - Audio processing state
- `sessionId: string | null` - Current chat session ID
- `error: string` - Error message
- `audioError: string` - Audio-specific error

---

## State Management

### ElderlyAuthContext

**Location**: `app/contexts/ElderlyAuthContext.tsx`

**Purpose**: Centralized authentication and session management.

**State Variables**:

#### Authentication

- `token: string | null` - JWT token from backend
- `elderlyData: ElderlyData | null` - User data (userid, preferred_name, admin_id, caregiver_assigned)
- `isAuthenticated: boolean` - Derived from token presence

#### Session Management

- `lastActivity: Date | null` - Last user activity timestamp
- `tokenCreatedAt: Date | null` - Token creation timestamp
- `logoutWarning: string | null` - Warning message before auto-logout

**Key Functions**:

#### Authentication

- `login(token, data)`: Store token and user data in state and localStorage
- `logout()`: Clear authentication state (keeps expired token for detection)

#### Activity Management

- `refreshActivity()`: Call `/refresh_elderly_activity` to update token activity timestamp

**Activity Monitoring**:

- Checks every 10 seconds for inactivity
- Shows warning at 14 minutes
- Auto-logout at 15 minutes inactivity or 24 hours token age

**LocalStorage Keys**:

- `elderlyToken`: JWT token (kept even after logout for expired token detection)
- `elderlyData`: User data JSON
- `elderlyLastActivity`: Last activity timestamp ISO string
- `elderlyTokenCreatedAt`: Token creation timestamp ISO string

---

## User Flows

### Login Flow

```
1. User visits / (login page)
2. User clicks "JOIN" button
3. If token exists in localStorage:
   - Decode token to get elderly_userid
   - Fetch elderly details from backend
   - Skip phone input, go to face verification
4. If no token:
   - Show phone number input
   - User enters phone number
   - Frontend sends POST /getelderlydetails
   - Backend returns elderly details
5. Frontend starts camera
6. User sees face capture interface
7. User clicks "Verify Face" button
8. Frontend captures frame from video
9. Frontend sends POST /verify_elderly_face with image
10. Backend verifies face and returns JWT token
11. Frontend stores token and redirects to /chat
```

### Chat Flow (Text)

```
1. User types message in input field
2. User presses Enter or clicks send button
3. Frontend adds user message to UI immediately
4. Frontend sends POST /chat/elderly with:
   - text: message content
   - sessionId: current session ID (if exists)
5. Backend processes message:
   - Creates session if needed
   - Runs AI inference
   - Returns response and sessionId
6. Frontend displays assistant response
7. Frontend refreshes activity timestamp
```

### Chat Flow (Speech-to-Speech)

```
1. User clicks microphone button
2. Browser requests microphone permission
3. MediaRecorder starts recording
4. User speaks
5. User clicks microphone again to stop
6. Audio blob created (WebM format)
7. Frontend sends POST /speech_to_speech with:
   - audio: audio blob
   - sessionId: current session ID (optional)
8. Backend processes:
   - Converts audio to WAV
   - Runs Saarika STT (for immediate transcript)
   - Starts background job for full processing
   - Returns job_id, transcript, language_code
9. Frontend displays transcript immediately as user message
10. Frontend starts polling /speech_to_speech/status/{job_id}
11. Backend processes in background:
    - Runs Saaras STT (speech-to-English)
    - Runs AI inference
    - Translates response
    - Generates TTS audio
12. When complete, backend returns:
    - localized_text: Response in user's language
    - audio_base64: TTS audio data URI
13. Frontend displays assistant message
14. Frontend auto-plays audio
15. Frontend refreshes activity timestamp
```

### Logout Flow

```
1. User clicks "Logout" button
2. Frontend calls logout() from context
3. Context clears state:
   - token = null
   - elderlyData = null
   - lastActivity = null
   - tokenCreatedAt = null
4. Context clears localStorage (except expired token)
5. Frontend redirects to / (login page)
```

### Auto-Logout Flow

```
1. User inactive for 14 minutes
2. Context shows warning: "Logging-out in 1 minute due to inactivity"
3. User inactive for 15 minutes
4. Context calls logout()
5. User redirected to login page
6. OR: Token age reaches 24 hours
7. Context calls logout()
8. User redirected to login page
```

---

## API Integration

### API Base URL

**Configuration**:

- Loads from `/url.json` (public_url field)
- Falls back to `process.env.NEXT_PUBLIC_API_BASE_URL`
- Defaults to `http://localhost:5000` if neither available

**Implementation**: Fetched on component mount and stored in state.

### API Endpoints Used

#### Authentication

- `POST /getelderlydetails` - Get elderly details by phone number or userid
- `POST /verify_elderly_face` - Verify face and get JWT token
- `POST /refresh_elderly_activity` - Refresh token activity timestamp

#### Chat

- `POST /chat/elderly` - Send text message
- `POST /speech_to_speech` - Send audio for speech-to-speech processing
- `GET /speech_to_speech/status/{job_id}` - Check speech processing job status

### Request Headers

**Authentication**: All authenticated requests include:

```
Authorization: Bearer ${token}
```

**Content-Type**:

- JSON requests: `application/json`
- Multipart requests: `multipart/form-data` (for audio)

### Error Handling

**API Errors**:

- **401 Unauthorized**: Redirect to login
- **400 Bad Request**: Show error notification
- **404 Not Found**: Show "not found" message
- **500 Server Error**: Show generic error notification

**Network Errors**:

- Timeout handling for long-running requests
- Retry logic for job polling (exponential backoff)

---

## Styling & UI

### CSS Framework

**Tailwind CSS**: Utility-first CSS framework

**Key Features**:

- Responsive design utilities (`sm:`, `md:`, `lg:`)
- Flexbox and Grid utilities
- Color system (purple/blue gradient theme)
- Spacing system (`p-4`, `m-2`, `gap-3`)

### Custom Styles

**Global Styles**: `app/globals.css`

- Base styles
- Custom CSS variables
- Background images
- Gradient utilities

### Responsive Design

**Breakpoints**:

- Mobile: Default (< 1024px)
- Desktop: `lg:` prefix (≥ 1024px)

**Mobile Adaptations**:

- Full-width buttons
- Optimized touch targets
- Single column layouts
- Mobile-first camera interface

**Desktop Adaptations**:

- Centered layouts
- Larger touch targets
- Side-by-side elements

### UI Components

**Login Page**:

- Welcome card with phone input
- Camera interface with face capture overlay
- Error notifications
- Loading states

**Chat Page**:

- Navbar with user avatar and logout button
- Message bubbles (user: purple gradient, assistant: white)
- Input area with microphone and send buttons
- Recording indicators (red blinking dot)
- Processing indicators (yellow blinking dot)
- Loading spinner for responses

**Color Scheme**:

- Primary: Purple (`purple-600`, `purple-500`)
- Secondary: Blue (`blue-600`, `blue-500`)
- Accent: Green (`green-600`) for login button
- Error: Red (`red-500`) for logout and errors
- Background: Gradient from purple-50 to blue-50

---

## TypeScript Types

### Core Types

```typescript
interface ElderlyData {
  elderly_userid: string;
  preferred_name: string;
  admin_id: string;
  caregiver_assigned: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface JWTPayload {
  elderly_userid?: number;
  admin_id?: number;
  caregiver_assigned?: string;
  session_id?: string;
  exp?: number;
  iat?: number;
  last_activity?: number;
}
```

---

## Key Implementation Details

### Face Verification

**Camera Access**:

- Uses `navigator.mediaDevices.getUserMedia()` API
- Requests front-facing camera (`facingMode: "user"`)
- Ideal resolution: 640x480

**Image Capture**:

- Draws video frame to hidden canvas
- Converts to JPEG base64 (80% quality)
- Sends base64 string to backend

**Failure Handling**:

- Tracks failure count
- After 5 failures, shows "Enter Number" button
- Allows user to re-enter phone number

### Speech-to-Speech

**Audio Recording**:

- Uses MediaRecorder API
- Records as WebM format
- Stores chunks in memory

**Job Polling**:

- Polls every 1.5 seconds initially
- Increases to 2 seconds on error
- Clears polling on component unmount
- Maximum polling duration: ~30 seconds (backend timeout)

**Audio Playback**:

- Creates HTML5 Audio element
- Plays base64 data URI automatically
- Handles playback errors gracefully

### Activity Refresh

**Triggers**:

- User typing (debounced 1 second)
- User scrolling (debounced 1 second)
- Sending messages
- Receiving responses

**Implementation**:

- Calls `/refresh_elderly_activity` endpoint
- Updates token and lastActivity in context
- Updates localStorage

### Token Expiration Detection

**Client-Side Check**:

- Decodes JWT token (without verification)
- Checks `exp` field against current time
- Used to detect expired tokens on login page

**Server-Side Check**:

- Backend validates token on each request
- Returns 401 if token expired or invalid

---

## Error Handling

### API Errors

- **401 Unauthorized**: Redirect to login, clear authentication state
- **400 Bad Request**: Show error notification with message
- **404 Not Found**: Show "not found" message
- **500 Server Error**: Show generic error notification

### Camera Errors

- **Permission Denied**: Show error message requesting permission
- **Device Not Found**: Show error message
- **Stream Error**: Show generic camera error

### Microphone Errors

- **Permission Denied**: Show error message requesting permission
- **Device Not Found**: Show error message
- **Recording Error**: Show generic recording error

### Network Errors

- **Timeout**: Retry with exponential backoff
- **Connection Error**: Show error notification
- **CORS Error**: Check API URL configuration

---

## Performance Optimizations

### Code Splitting

- Next.js automatic code splitting
- Dynamic imports for heavy components (if needed)

### State Management

- Minimal re-renders with React hooks
- Debounced activity refresh
- Efficient polling with cleanup

### Audio Handling

- Blob storage in memory (not persisted)
- Automatic cleanup of MediaRecorder streams
- Efficient base64 audio playback

---

## Future Enhancements

### Potential Improvements

1. **Offline Support**: Service worker for offline functionality
2. **Error Recovery**: Automatic retry for failed requests
3. **Loading States**: Skeleton loaders for better UX
4. **Accessibility**: ARIA labels and keyboard navigation
5. **Internationalization**: Multi-language support
6. **Dark Mode**: Theme switching
7. **PWA**: Progressive Web App capabilities
8. **Voice Activity Detection**: Auto-stop recording on silence
9. **Message History**: Load previous chat sessions
10. **Typing Indicators**: Show when assistant is processing

---

## Development Notes

### Running the Application

```bash
npm run dev
# or
yarn dev
```

### Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`: Backend API URL (default: http://localhost:5000)

### Build Process

```bash
npm run build
npm start
```

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting (if configured)

---

## Troubleshooting

### Common Issues

1. **Token Expired**: Clear localStorage and re-login
2. **CORS Errors**: Check backend CORS configuration
3. **Camera Not Working**: Check browser permissions
4. **Microphone Not Working**: Check browser permissions
5. **Audio Not Playing**: Check browser audio permissions
6. **Face Verification Failing**: Ensure good lighting and face visibility
7. **Job Polling Timeout**: Check backend job processing status

### Debug Tips

- Check browser console for errors
- Verify localStorage contents
- Inspect network requests in DevTools
- Check API response format matches expected types
- Verify token expiration times
- Check activity timestamps in localStorage

---
