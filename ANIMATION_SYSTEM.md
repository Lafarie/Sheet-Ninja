# Falling Animation System

A beautiful falling animation system that displays hearts (or other emoji) when users login or visit the application.

## Features

- 🎯 **User-specific view counting**: Each user has a limited number of times they can see the animation
- 🎨 **Customizable items**: Admin can configure what falls (hearts, sparkles, confetti, etc.)
- ⚙️ **Admin controls**: Full admin panel to manage animation settings
- 📊 **Analytics**: Track views and user engagement
- 🔄 **Presets**: Quick preset configurations for different types of animations
- 💨 **Performance optimized**: Uses Framer Motion for smooth animations

## How it Works

1. **User Login**: When a user signs in, the system checks if they should see the animation
2. **View Counting**: Each view is recorded in the database
3. **Limit Check**: Users can only see the animation a certain number of times (configurable by admin)
4. **Animation Display**: Beautiful falling items cascade from top to bottom

## Admin Features

Access the admin panel at `/v2/admin/animation` (admin users only):

- **Enable/Disable** animations globally
- **Configure items** that fall (emoji, characters, etc.)
- **Set animation parameters** (count, duration, etc.)
- **Manage view limits** per user
- **View statistics** and recent activity
- **Reset view counts** for all users
- **Quick presets** for different animation types

## Animation Types

### Built-in Presets:
- **Hearts** ❤️💖💕💗💝💓💞💘
- **Sparkles** ✨⭐🌟💫⚡🌠💥
- **Celebration** 🎉🎊🎈🎁🎀🍾🥳🎂
- **Nature** 🌸🌺🌻🌷🌹🌼🌿🍀
- **Food** 🍕🍔🍟🍰🍪🍩🧁🍫
- **Animals** 🐱🐶🐰🐸🦄🐝🦋🐠

## Database Schema

### AnimationSettings
- `isEnabled`: Global animation toggle
- `items`: Array of emoji/characters to display
- `itemCount`: Number of items to show
- `duration`: Animation duration in ms
- `maxViewsPerUser`: Maximum views per user

### AnimationView
- `userId`: Reference to user
- `viewCount`: Number of times user has seen animation
- `lastViewAt`: Last time user saw animation

## Usage

### For Users
- Simply login or visit the page
- Enjoy the falling animation (if enabled and within view limit)
- Animation automatically stops after configured duration

### For Admins
1. Login with admin account
2. Navigate to Animation Admin panel
3. Configure settings as desired
4. Preview changes before saving
5. Monitor usage statistics

## Development

The system consists of:
- **Components**: `FallingAnimation`, `AnimationAdminPanel`
- **Hooks**: `useAnimation`
- **API Routes**: `/api/animation`, `/api/admin/animation`
- **Database Models**: `AnimationSettings`, `AnimationView`

## Configuration

Default settings:
- **Enabled**: Yes
- **Items**: Hearts (❤️💖💕💗💝)
- **Item Count**: 50
- **Duration**: 3000ms (3 seconds)
- **Max Views**: 5 per user

All settings can be modified through the admin panel.