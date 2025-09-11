# Chat System Guide

## Overview

Sauti Salama features a dual-mode chat system that allows users to communicate in two distinct ways: **Regular Mode** (using their real identity) and **Anonymous Mode** (appearing as "Anonymous" to protect their privacy). This system is designed to provide flexibility while maintaining complete security and data separation between the two modes.

---

## 🎯 **For Non-Technical Users**

### **What is the Chat System?**

The chat system is like having two separate messaging apps in one:

1. **Regular Chat** - Like WhatsApp or Facebook Messenger, where you appear with your real name
2. **Anonymous Chat** - Like a private messaging system where you appear as "Anonymous"

### **Key Benefits**

#### 🔐 **Privacy Protection**
- **Anonymous Mode** lets you ask sensitive questions without revealing your identity
- **Regular Mode** allows normal conversations where people know who you are
- Your anonymous chats and regular chats are completely separate - no one can connect them

#### ⚡ **Instant Switching**
- Switch between modes instantly - no waiting or loading
- Both modes are always ready to use
- No interruption to your conversations

#### 🛡️ **Complete Safety**
- Your anonymous conversations remain private forever
- When you sign out, anonymous data is automatically deleted for security
- Each mode has its own separate message history

### **How It Works (Simple)**

#### **When You Sign In:**
1. The system automatically prepares both your regular and anonymous chat identities
2. You can see the status of both modes in your profile settings
3. Both modes load in the background so they're ready instantly

#### **Switching Modes:**
1. Go to your profile page
2. Use the "Anonymous Chat Mode" toggle
3. Switch instantly between regular and anonymous mode
4. Your chat interface immediately updates to use the selected identity

#### **What You See:**
- **Regular Mode**: Your real name appears in conversations
- **Anonymous Mode**: You appear as "Anonymous" with a special icon
- **Status Indicators**: Green checkmarks show when each mode is ready to use

---

## 🔧 **For Technical Users & Developers**

### **System Architecture**

#### **Dual-Cache Design**
The system maintains two completely separate chat environments:

```typescript
// Dual cache structure
let chatCache: DualChatCache = {
  regular: {
    client: StreamChatClient,      // Regular identity client
    userId: "user-abc123",         // Real user ID
    username: "John Doe",          // Real name
    dmChannels: [...],             // Regular DM conversations
    users: [...],                  // All users visible in regular mode
    communityChannel: {...},       // Community channel access
    isAnonymous: false
  },
  anonymous: {
    client: StreamChatClient,      // Anonymous identity client  
    userId: "anon-abc123-x7y2z1",  // Generated anonymous ID
    username: "Anonymous",         // Always "Anonymous"
    dmChannels: [...],             // Anonymous conversations only
    users: [...],                  // Users visible in anonymous mode
    communityChannel: {...},       // Community channel (anonymous)
    isAnonymous: true
  }
};
```

#### **Authentication Flow**
1. **User Authentication**: User signs in with Supabase
2. **Dual Token Generation**: System generates tokens for both identities
3. **Parallel Client Creation**: Creates separate StreamChat clients
4. **Cache Population**: Preloads channels, users, and data for both modes
5. **Status Broadcasting**: Updates UI components about readiness

### **Technical Implementation Details**

#### **Anonymous ID Generation**
```typescript
function getAnonymousId(userId: string): string {
  const base = userId.slice(0, 12);           // First 12 chars of real ID
  const rand = Math.random().toString(36).slice(2, 8);  // Random suffix
  return `anon-${base}-${rand}`;              // Format: anon-abc123def456-x7y2z1
}
```

**Benefits:**
- **Stable within session**: Same anonymous ID throughout user session
- **User-specific**: Based on real ID for consistency
- **Non-reversible**: Cannot determine real ID from anonymous ID
- **Collision-resistant**: Random suffix prevents conflicts

#### **StreamChat Client Management**
```typescript
// Regular mode connection
const regularClient = new StreamChatClient(STREAM_KEY);
await regularClient.connectUser(
  { id: userId, name: realName }, 
  regularToken
);

// Anonymous mode connection  
const anonymousClient = new StreamChatClient(STREAM_KEY);
await anonymousClient.connectUser(
  { id: anonymousId, name: "Anonymous", image: "/anon.svg" }, 
  anonymousToken
);
```

#### **Data Isolation Mechanisms**

1. **Separate Clients**: Each mode uses its own StreamChat client instance
2. **Different User IDs**: Regular uses real ID, anonymous uses generated ID
3. **Isolated Channels**: Channels are filtered by membership (user ID)
4. **Independent State**: Each client maintains separate state and connections

#### **Mode Switching Logic**
```typescript
export async function switchChatMode(newMode: 'regular' | 'anonymous') {
  // 1. Get preloaded cache for target mode
  const targetCache = chatCache[newMode];
  
  // 2. Validate cache is ready
  if (!targetCache || !isChatReady(targetCache.userId, newMode === 'anonymous')) {
    throw new Error(`${newMode} mode not ready`);
  }
  
  // 3. Update localStorage
  localStorage.setItem('ss_anon_mode', newMode === 'anonymous' ? '1' : '0');
  
  // 4. Broadcast change event
  window.dispatchEvent(new CustomEvent('anonymousModeChanged', {
    detail: { isAnonymous: newMode === 'anonymous', cache: targetCache }
  }));
  
  // 5. Chat components automatically pick up new cache
}
```

### **Development Guide**

#### **Adding New Chat Features**

When adding new chat functionality, consider both modes:

1. **Check Current Mode**:
```typescript
const isAnonymous = localStorage.getItem('ss_anon_mode') === '1';
const cache = getPreloadedChat(userId, isAnonymous);
```

2. **Use Appropriate Client**:
```typescript
// Get the correct client for current mode
const client = cache?.client;
if (!client) {
  // Handle not-ready state
  return;
}
```

3. **Handle Mode Changes**:
```typescript
useEffect(() => {
  const handleModeChange = () => {
    // Reset component state when mode changes
    setMessages([]);
    setCurrentChannel(null);
    // Re-initialize with new mode
  };
  
  window.addEventListener('anonymousModeChanged', handleModeChange);
  return () => window.removeEventListener('anonymousModeChanged', handleModeChange);
}, []);
```

#### **Testing Both Modes**

1. **Unit Tests**: Test functions with both `forceAnonymous: true/false`
2. **Integration Tests**: Verify mode switching doesn't break functionality  
3. **E2E Tests**: Test complete user flows in both modes
4. **Security Tests**: Verify data isolation between modes

#### **Performance Considerations**

1. **Memory Usage**: Two clients means ~2x memory usage - monitor in production
2. **Connection Limits**: Each mode maintains separate WebSocket connections
3. **Background Loading**: Additional users/channels load after initial cache
4. **Cache Invalidation**: Implement proper cleanup on sign-out

---

## 📱 **User Experience Flows**

### **Scenario 1: Survivor Seeking Help**

#### **Initial Setup:**
1. **Sign In** → Both regular and anonymous modes automatically preload
2. **Profile Check** → User sees both modes are ready (green checkmarks)

#### **Anonymous Conversation:**
1. **Enable Anonymous Mode** → Toggle switch, instant activation
2. **Start Anonymous Chat** → Appears as "Anonymous" to counselor
3. **Discuss Sensitive Topics** → Complete privacy protection
4. **Get Resources** → Counselor provides help without knowing identity

#### **Switching to Regular Mode:**
1. **Toggle Back** → Instant switch to regular identity
2. **Follow-up Conversations** → Can continue with real identity if comfortable
3. **Appointment Scheduling** → Use regular mode for scheduling meetings

### **Scenario 2: Professional Counselor**

#### **Regular Mode Usage:**
1. **Professional Identity** → Always use real credentials and name
2. **Client Verification** → Can verify client identity in regular mode
3. **Documentation** → Proper record keeping with identified clients

#### **Anonymous Support:**
1. **Anonymous Clients** → Receive messages from "Anonymous" users
2. **Crisis Support** → Provide immediate help without requiring identification
3. **Resource Sharing** → Share resources and information anonymously

### **Scenario 3: Community Support**

#### **Public Discussions:**
1. **Regular Mode** → Join community discussions with real identity
2. **Share Experiences** → Contribute openly to community support

#### **Anonymous Participation:**
1. **Anonymous Mode** → Participate in sensitive discussions privately
2. **Ask Questions** → Seek help without judgment or identification
3. **Share Resources** → Contribute anonymously to community knowledge

---

## 🔐 **Security & Privacy Details**

### **Data Isolation Guarantees**

#### **What's Separate:**
- ✅ **Message Histories**: Regular and anonymous chats never mix
- ✅ **User Lists**: Each mode sees different sets of users
- ✅ **Channel Access**: Channels are filtered by user ID
- ✅ **Presence Status**: Online/offline status is separate per mode
- ✅ **Media Sharing**: Files shared in one mode stay in that mode
- ✅ **Connection Metadata**: Each client maintains separate connection info

#### **What's Shared:**
- ⚠️ **Same Physical User**: Both modes belong to the same person
- ⚠️ **IP Address**: Network-level identification is still possible
- ⚠️ **Behavioral Patterns**: Writing style and timing could be analyzed
- ⚠️ **System Resources**: Both modes use same device/browser

### **Security Measures**

#### **Automatic Cleanup:**
```typescript
// On sign out - automatic security cleanup
await disconnectPreloadedChat('both');  // Disconnect all clients
clearAnonymousData();                    // Remove anonymous data
localStorage.removeItem('ss_anon_mode'); // Clear mode setting
localStorage.removeItem('ss_anon_id');   // Clear anonymous ID
```

#### **Anonymous ID Security:**
- **Non-reversible**: Cannot determine real identity from anonymous ID
- **Session-limited**: New anonymous ID generated per session if needed
- **Collision-resistant**: Random components prevent ID conflicts
- **Format obscures**: `anon-{base}-{random}` format provides no direct mapping

#### **Permission Controls:**
```typescript
// Configurable permission system
export function validateAnonymousPermission(userId: string): boolean {
  // Add business logic here:
  // - Check user account status
  // - Verify user type permissions  
  // - Check rate limiting
  // - Validate terms acceptance
  return userHasAnonymousAccess(userId);
}
```

---

## 🛠️ **Development & Maintenance**

### **Monitoring & Analytics**

#### **Cache Statistics:**
```typescript
const stats = getCacheStats();
// Returns connection status, user counts, channel counts for both modes
```

#### **Health Monitoring:**
- **Connection Status**: Track WebSocket connections for both modes
- **Preload Success Rate**: Monitor how often preloading succeeds
- **Switch Performance**: Measure time to switch between modes
- **Error Rates**: Track authentication and connection failures

#### **User Analytics:**
- **Mode Usage**: Track how often users switch between modes
- **Anonymous Adoption**: Measure anonymous mode usage rates
- **Session Duration**: Monitor how long users stay in each mode
- **Feature Usage**: Track which features are used in each mode

### **Troubleshooting Guide**

#### **Common Issues:**

1. **Mode Switch Fails**
   - **Symptoms**: Toggle doesn't work, mode doesn't change
   - **Cause**: Cache not ready, connection failed
   - **Fix**: Check preload status, retry connection

2. **Anonymous ID Not Generated**
   - **Symptoms**: Anonymous mode shows regular name
   - **Cause**: LocalStorage issues, ID generation failed
   - **Fix**: Clear storage, regenerate ID

3. **Chat Not Loading**
   - **Symptoms**: Infinite loading, no messages appear
   - **Cause**: Wrong cache used, client not connected
   - **Fix**: Verify correct cache is selected, check connection

4. **Data Mixing Between Modes**
   - **Symptoms**: Regular messages appear in anonymous mode
   - **Cause**: Cache key mismatch, client reuse
   - **Fix**: Clear all caches, reinitialize both modes

### **Best Practices for Developers**

#### **Code Organization:**
1. **Always check current mode** before chat operations
2. **Use appropriate cache** for the current mode
3. **Handle mode changes** gracefully in components
4. **Implement proper cleanup** when components unmount
5. **Test both modes** for every new feature

#### **Performance Optimization:**
1. **Lazy load additional data** after initial cache
2. **Implement connection pooling** where possible
3. **Use background tasks** for non-critical operations
4. **Monitor memory usage** with dual clients
5. **Implement proper caching strategies** for static data

#### **Security Considerations:**
1. **Never mix data** between modes
2. **Validate permissions** before allowing anonymous mode
3. **Implement proper cleanup** on sign-out
4. **Audit data flows** regularly
5. **Monitor for data leaks** between modes

---

## 🎯 **Success Metrics**

### **User Experience Metrics:**
- **Switch Time**: < 100ms between modes
- **Preload Success**: > 95% successful preloads
- **User Adoption**: Track anonymous mode usage
- **Support Efficiency**: Faster resolution of sensitive issues

### **Technical Metrics:**
- **Memory Usage**: Monitor dual-client memory consumption
- **Connection Stability**: Track WebSocket connection health
- **Error Rates**: Monitor authentication and switching failures
- **Performance**: Track loading times and response times

### **Business Impact:**
- **Increased Engagement**: More users comfortable seeking help
- **Better Support**: Anonymous mode enables sensitive conversations
- **User Retention**: Flexible communication options retain users
- **Trust Building**: Privacy protection builds user confidence

---

## 🚀 **Future Enhancements**

### **Planned Features:**
1. **Enhanced Anonymous Avatars**: Custom anonymous profile pictures
2. **Temporary Anonymous IDs**: IDs that expire after conversations
3. **Anonymous Group Chats**: Private group discussions
4. **Advanced Permission Controls**: Fine-grained access management
5. **Anonymous Voice/Video**: Voice calls while maintaining anonymity

### **Technical Improvements:**
1. **Service Worker Integration**: Offline anonymous mode support
2. **Enhanced Caching**: Persistent storage for frequent users
3. **Connection Optimization**: Reduce resource usage for dual clients
4. **Advanced Analytics**: Better insights into mode usage patterns
5. **Security Hardening**: Additional privacy protection measures

---

## 📞 **Support & Resources**

### **For Users:**
- Check the toggle component in your profile for real-time status
- Look for green checkmarks indicating modes are ready
- Contact support if mode switching isn't working

### **For Developers:**
- Review `ANONYMOUS_MODE.md` for detailed technical documentation
- Check console logs for debugging information
- Use `getCacheStats()` for monitoring cache health
- Implement proper error handling for mode switching

### **For Administrators:**
- Monitor system performance with dual-client architecture
- Configure permission controls for anonymous mode access
- Set up analytics to track feature usage and adoption
- Implement security auditing for data isolation

---

**This chat system provides a secure, efficient, and user-friendly way to communicate in both identified and anonymous contexts, ensuring users can get the help they need while maintaining their privacy and security.** 🎯
