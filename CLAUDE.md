# CLAUDE.md for Accelerate WordPress Plugin

## Project Overview

**Accelerate** is a sophisticated WordPress plugin that extends the block editor with marketing capabilities including analytics, A/B testing, and personalization. Developed by Human Made, it integrates with a cloud analytics service to provide block-level insights and content optimization tools.

### Key Features
- Synced Patterns/Blocks with analytics
- Native block-level A/B testing
- Content personalization with audience targeting
- Broadcast blocks for content promotion
- Content Explorer dashboard
- GDPR-compliant analytics with EU data hosting

## Architecture & Tech Stack

### Backend (PHP)
- **Framework**: WordPress 6.4+ plugin architecture
- **PHP Version**: 7.4+ with modern type hints
- **Namespace**: `Altis\Accelerate`
- **Dependencies**: Composer managed (Guzzle, Math-PHP, Segment Analytics)
- **Standards**: WordPress-VIP-Go coding standards

### Frontend (JavaScript/TypeScript)
- **Framework**: React 18 with TypeScript
- **State Management**: WordPress Data API (@wordpress/data)
- **UI Components**: WordPress Components (@wordpress/components)
- **Build System**: Webpack with Human Made helpers
- **Styling**: SCSS + Tailwind CSS with scoped preflight

### Development Environment
- **Local Setup**: Docker Compose (WordPress + ClickHouse + Grafana)
- **Database**: ClickHouse for analytics data
- **Testing**: PHPUnit + Playwright E2E tests
- **Linting**: PHPCS + ESLint

## File Structure

```
accelerate/
├── plugin.php                 # Main plugin file
├── inc/                       # PHP source code
│   ├── namespace.php          # Bootstrap functions
│   ├── admin/                 # Admin interface
│   ├── analytics/             # Analytics integration
│   ├── audiences/             # Audience management
│   ├── blocks/                # Block functionality
│   ├── dashboard/             # Analytics dashboard
│   ├── experiments/           # A/B testing
│   └── global-blocks/         # Synced patterns
├── src/                       # Frontend source (React/TS)
│   ├── accelerate/            # Main admin interface
│   ├── audiences/             # Audience management UI
│   ├── dashboard/             # Analytics dashboard UI
│   └── global-blocks/         # Block editor extensions
├── build/                     # Compiled assets
├── .config/                   # Build configuration
├── tests/                     # Test suites
└── vendor/                    # PHP dependencies
```

## Development Workflow

### Local Development Setup
```bash
# Start development environment
composer start

# Install dependencies and build
composer build-deps

# Development server with hot reload
npm start

# Run tests
composer phpunit
npm run playwright
```

### Build Commands
```bash
# Development build with watch
npm start

# Production build
npm run build

# Linting
npm run lint          # JS + PHP
npm run lint:php      # PHP only
npm run lint:js       # JS only

# Auto-fix linting issues (recommended after code changes)
npx eslint ./src --fix
```

### Docker Services
- **WordPress**: Main application (port 8081)
- **ClickHouse**: Analytics database
- **Grafana**: Analytics visualization (port 3600)

## Key Components

### Plugin Bootstrap (`inc/namespace.php`)
- Loads asset-loader plugin
- Configures cloud service constants
- Conditionally loads feature modules
- Sets up WordPress hooks and filters

### Admin Interface (`src/accelerate/`)
- React-based admin dashboard
- Redux store for state management
- Content explorer with performance metrics
- Block management interface

### Analytics System (`inc/analytics/`)
- Event tracking integration
- ClickHouse database connection
- GDPR-compliant data collection
- Real-time analytics processing

### Block Extensions (`src/global-blocks/`)
- Enhanced synced patterns
- A/B testing variants
- Personalization controls
- Broadcast block functionality

### Onboarding (`inc/admin/notices.php`)
- Dismissible page notifications for feature introduction
- Centralized notice system with heading, body, image, CTA support
- Auto-triggers on dashboard, broadcasts, and settings pages
- User setting persistence for dismissed notices

## API Integration

### External Services
- **Analytics API**: `https://eu.accelerate.altis.cloud/`
- **Dashboard**: `https://www.accelerateplugin.com/`
- **Data Hosting**: EU (Frankfurt, Germany)
- **Retention**: 90-day automatic deletion

### Authentication
- OAuth2 integration with Accelerate dashboard
- Token-based API authentication
- Admin capability checks for WordPress users

## Security Considerations

### WordPress Security
- Nonce verification for forms (`wp_nonce_field`, `wp_verify_nonce`)
- Input sanitization (`sanitize_text_field`, `esc_html`, `esc_url`)
- Capability checks for admin functions
- CSRF protection on critical operations

### Data Privacy
- GDPR compliant (EU data hosting)
- No third-party data sharing
- Visitor consent handling
- Business-to-business data processing agreements

## Testing Strategy

### PHP Unit Tests (PHPUnit)
- **Location**: `tests/phpunit/`
- **Key Files**: `ABCalcTest.php`, `GlobalBlockTest.php`, `bootstrap.php`
- **Framework**: WordPress unit test integration with mock functions

### Running Tests
```bash
# Run all tests
vendor/bin/phpunit tests/phpunit/

# Run A/B tests only
./run-ab-tests.sh

# Specific test
vendor/bin/phpunit tests/phpunit/ABCalcTest.php::test_clear_winner_gets_high_confidence
```

### E2E Tests (Playwright)
- Block editor integration testing
- Analytics dashboard functionality
- Configuration: `tests/e2e/playwright.config.ts`

## Configuration Files

### Build Configuration
- `webpack.config.dev.js` - Development build with hot reload
- `webpack.config.prod.js` - Production optimized build
- `tailwind.config.js` - CSS framework configuration
- `tsconfig.json` - TypeScript configuration

### Quality Assurance
- `phpcs.xml.dist` - PHP CodeSniffer rules (WordPress-VIP-Go)
- `phpunit.xml.dist` - PHPUnit configuration
- `.eslintrc` - JavaScript linting rules

## Feature: Block Portal (Accelerate Header Dashboard above Block Editing)

The plugin uses React portals with scoped Tailwind CSS to inject analytics dashboards into the WordPress block editor.

### Portal Architecture
```javascript
// Main portal injection (src/global-blocks/index.js)
useEffect(() => {
  const waitForTarget = () => {
    const el = document.querySelector('.interface-interface-skeleton__content');
    if (el) {
      el.insertBefore(portalNode.current, el.firstChild);
      setContainer(el);
    } else {
      requestAnimationFrame(waitForTarget);
    }
  };
  waitForTarget();
}, []);

return createPortal(
  <div className="tailwind" style={{ width: '100%' }}>
    <Header />
  </div>,
  portalNode.current
);
```

### Key Components
- **Header Component** (`Header.tsx`): Main analytics dashboard with period selection (7D/30D/90D), conversion tracking, A/B test controls
- **Variant Row Component** (`VariantRow.tsx`): Individual variant entries with thumbnails, metrics, probability calculations
- **Static Global Block** (`index.tsx`): Placeholder blocks with edit links and thumbnails
- **Modal Component** (`modal.js`): WordPress-style overlays for audience editing
- **Broadcast Manager** (`src/accelerate/broadcast-manager/`): Admin UI for managing broadcasts with block selection

### Content Generation Guidelines
- **Portal Injection**: Always wait for WordPress editor skeleton (`.interface-interface-skeleton__content`) before injecting
- **Tailwind Scoping**: Wrap all portal content in `<div className="tailwind">` for CSS isolation
- **Data Integration**: Use `useSelect` hooks to fetch analytics from Redux store
- **Dynamic Rendering**: Render different interfaces based on block type (standard/abtest/personalization)
- **WordPress API**: Leverage WordPress Data API and editor hooks for seamless integration

### Technical Guardrails
- Portal nodes must be created with `document.createElement('div')`
- Always use `requestAnimationFrame` for DOM element waiting
- Scoped Tailwind prevents style conflicts with WordPress admin
- Analytics data should be real-time using Redux store updates
- Modal portals should target `document.body` for proper z-index stacking
- **WordPress Modal**: Do NOT wrap `@wordpress/components` Modal with `styled-components` - it breaks portal rendering. Use SCSS with className instead

### Spark Charts & Mini Visualizations
Small inline charts for quick metric visualization within portal headers and variant rows.

**Common Uses:**
- Variant performance trend lines next to conversion rates
- 7-day sparklines in header summary cards  
- A/B test confidence intervals
- Audience reach trend indicators

**Technical Requirements:**
- Use minimal visx components (LinePath, scaleLinear, scaleTime) 
- Responsive design adapting to portal container width
- Aggregate data points for performance (max 20 points)
- Include ARIA labels for accessibility
- Fetch data via Redux store: `select('accelerate').getSparklineData(blockId, '7D')`

**Performance Considerations:**
- Lightweight rendering to avoid bundle bloat
- Cache sparkline data to prevent excessive API calls
- Use CSS transforms for hover interactions instead of re-renders

### Variant Selection Integration
When implementing variant switching in portal interfaces, coordinate with WordPress block editor state:

**Index Mapping Issue**: WordPress block indices don't always match filtered array indices. Convert between them:
```javascript
// Convert WordPress block index to UI array index
const selectedVariant = useSelect((select) => {
  const blockIndex = select(PreferencesStore).get('scope', `${postId}:variant`) || 0;
  const { getBlockIndex } = select(BlockEditorStore);
  const arrayIndex = variants.findIndex(v => getBlockIndex(v.clientId) === blockIndex);
  return arrayIndex >= 0 ? arrayIndex : 0;
}, [postId, variants]);
```

**Block Selection Strategy**: Use `selectBlock(clientId)` to trigger variant switching, let WordPress handle preference updates automatically rather than manually setting preferences. **Key insight**: Empty variants need default inner blocks (e.g., `createBlock('core/paragraph')`) to be immediately editable - `createBlock` creates empty blocks while `cloneBlock` preserves existing content structure.

### Common Patterns
```javascript
// Wait for DOM element pattern
const waitForTarget = () => {
  const el = document.querySelector(selector);
  if (el) {
    // Inject portal
  } else {
    requestAnimationFrame(waitForTarget);
  }
};

// Scoped Tailwind container
<div className="tailwind">
  {/* All Tailwind styles scoped here */}
</div>
```

## Common Development Tasks

### Adding New Features
1. Create PHP namespace in `inc/[feature]/`
2. Add React components in `src/[feature]/`
3. Register webpack entry point in build config
4. Add feature toggle in `configure_features()`
5. Include in plugin bootstrap

### Block Development
1. Create block definition in `inc/blocks/[name]/`
2. Add React edit component in `src/blocks/[name]/`
3. Register block in `block.json`
4. Add to webpack entries

### API Endpoints
1. Create controller in `inc/[module]/rest_api/`
2. Extend `WP_REST_Controller`
3. Register routes in namespace bootstrap
4. Add permission callbacks
