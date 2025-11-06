---
description: Analyze application performance and suggest optimizations
argument-hint: [component-name]
---

Analyze the performance of the IdeaFlow application$1 and identify optimization opportunities.

Please examine:

1. **React Performance**
   - Unnecessary re-renders and render optimization
   - Missing React.memo, useMemo, useCallback usage
   - Large component trees and virtualization needs
   - Key prop usage in lists
   - State update batching

2. **Bundle Size & Loading**
   - Bundle analysis and code splitting opportunities
   - Lazy loading components
   - Tree-shaking effectiveness
   - Dependency size impact
   - Tailwind CSS via CDN vs bundled

3. **Runtime Performance**
   - Expensive computations and algorithms
   - Memory leaks (event listeners, timers)
   - LocalStorage read/write frequency
   - Debouncing and throttling usage
   - DOM manipulation efficiency

4. **API & Network**
   - Gemini API call optimization
   - Request batching opportunities
   - Caching strategies
   - Audio processing efficiency
   - Base64 encoding overhead

5. **User Experience**
   - Time to interactive (TTI)
   - First contentful paint (FCP)
   - Layout shifts
   - Loading states and skeleton screens
   - Perceived performance

For each issue found, provide:
- Specific file and line references (file:line)
- Performance impact (High, Medium, Low)
- Concrete optimization recommendations
- Estimated improvement potential
