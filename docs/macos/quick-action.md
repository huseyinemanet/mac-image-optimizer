# macOS Quick Action Stub

This is a manual stub to create a Finder Quick Action that passes selected files/folders to the app.

## Steps

1. Open **Automator** and create a new **Quick Action**.
2. Set:
   - "Workflow receives current" = files or folders
   - "in" = Finder
3. Add action **Run Shell Script**.
4. Use script template (adjust app path):

```bash
for f in "$@"; do
  open -a "Crunch" "$f"
done
```

5. Save as `Optimise Images`.

Notes:
- This is a stub only. You can extend it to pass CLI flags if you add CLI parsing to the app.
