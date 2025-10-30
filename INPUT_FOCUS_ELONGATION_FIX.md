# Input Focus Elongation Fix

## Problem
When clicking on the input box for sheet link, the composer was automatically elongating/resizing.

## Root Cause
- Gmail's compose container has dynamic height adjustment
- Input focus events trigger Gmail's internal resize logic
- Content inside compose dialog was causing height recalculation

## Solution Implemented

### 1. Fixed Max Height in CSS
```css
.aem-bulk-mini {
  max-height: 350px !important;
  overflow: hidden;
  position: relative;
}
```
- Forces panel to never exceed 350px
- `!important` overrides Gmail's dynamic styles
- `overflow: hidden` prevents content spill

### 2. Content Layer with Max Height
```css
.aem-mini-content {
  max-height: 300px;
  overflow-y: auto;
  display: none;
}
```
- Scrollable content area
- Never expands beyond 300px
- Hidden by default

### 3. Input Event Handling
```javascript
input.addEventListener('focus', (e) => {
  e.stopPropagation();
  panel.style.maxHeight = '350px';
});
```
- Prevents event bubbling to Gmail
- Explicitly sets max height on focus
- Blocks Gmail's resize logic

### 4. Box-sizing Fix
```css
box-sizing: border-box;
```
- Proper padding/border calculation
- Prevents unexpected width/height changes

## Key Changes

### CSS Updates
- `max-height: 350px !important` - Hard limit
- `overflow: hidden` - No spillover
- `position: relative` - Contains content
- Content area: `max-height: 300px` with scroll

### JavaScript Updates
- Event propagation stopped on input focus
- Explicit max-height setting on focus
- All inputs (URL, delay, time) handled

### Layout Updates
- Proper flex layout for input group
- Box-sizing on all inputs
- White-space nowrap on buttons

## Result

### Before:
- Click input → Composer expands dramatically
- Focus causes full-height expansion
- Gmail's dynamic resize activated

### After:
- Click input → Panel stays at max 350px
- Focus doesn't trigger expansion
- Hard height limits enforced

## Technical Details

### Height Hierarchy:
1. **Panel**: Max 350px (never exceeds)
2. **Header**: ~50px (fixed)
3. **Content**: Max 300px with scroll
4. **Total visible**: ~50px collapsed, ~350px expanded

### Event Flow:
```
User clicks input
  ↓
Focus event fired
  ↓
stopPropagation() prevents Gmail resize
  ↓
Max height enforced explicitly
  ↓
Composer stays compact ✓
```

---

**Status**: ✅ Elongation Fixed  
**Result**: Composer stays at fixed height regardless of input focus

