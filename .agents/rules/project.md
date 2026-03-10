---
trigger: always_on
---

You can freely add/edit/delete comments as needed but should try to maintain a proper conventions standard when writing documentation comments.

always try to improve ux and reduce clicks when necesary, reactive ui is better than more clicks.

Always prefer to create reusable components for better maintainability, avoiding large files.
using Separation of Concerns pattern and standards

Always use Better Generic Naming so is much clearer what this represents, so it follows common naming conventions for generic option types

When generating or modifying code, **always use the path for importing project files**.
**Never use relative paths** (`./` or `../`) for imports.
Reason: Uses relative paths (`../`, `./`), which are not allowed, ensuring consistency, maintainability, and correct module resolution.

do not run commands, you need to ask user for run commands for you
