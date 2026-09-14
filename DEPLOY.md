# Deploy PulseStation v3

1. Upload all 15 files to one GitHub repository root.
2. Do NOT use GitHub Pages as the functioning app.
3. In Render choose New -> Blueprint and connect that repository.
4. When Render asks for `PSN_NPSSO`, enter the private server-side NPSSO token.
5. Deploy and open the `.onrender.com` URL.
6. First test `/api/diagnostics`.
7. Then create an account. Registration is now independent from PSN import.

If `psnConfigured` is false, add `PSN_NPSSO` in Render -> service -> Environment and redeploy. If PlayStation rejects it, replace it with a fresh NPSSO.
