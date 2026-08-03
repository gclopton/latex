The 40-expression regression battery for Spike A and forever after ([[04 Spikes and Risks]], [[06 Testing Strategy]]). Phase 0 materializes each as `tests/fixtures/battery/NN-name.tex`. Tolerance classes per D16: `identical` (byte-equal round-trip required) or `cosmetic` (whitespace, brace normalization, `\left\right` insertion allowed; any command substitution, dropped token, or reordered argument = fail). Pass rule per D17: ≥36/40 edit naturally AND round-trip within tolerance; `cases` (#25) and basic `aligned` (#22) must be among the passes.

Sources: real expressions from the BDM campaign documentation plus standard lecture math. Grow-only: every future real-use bug adds its expression here before the fix lands.

Part of [[00 Overview and Doc Map]].

# Chemistry / defect notation (1–8)

1. `V_{\mathrm{O}}^{\bullet\bullet}` — cosmetic
2. `\mathrm{O_O} \rightarrow V_{\mathrm{O}}^{\bullet\bullet} + \tfrac{1}{2}\mathrm{O_2} + 2e^-` — cosmetic
3. `2\,\mathrm{Ce}^{4+} + 2e^- \rightarrow 2\,\mathrm{Ce}^{3+}` — cosmetic
4. `\mathrm{Ce}^{4+}\,(4f^0) \leftrightarrow \mathrm{Ce}^{3+}\,(4f^1)` — cosmetic
5. `\mathrm{CeO_2} \rightarrow \tfrac{1}{2}\mathrm{Ce_2O_3} + \tfrac{1}{4}\mathrm{O_2}` — cosmetic
6. `U_{\mathrm{eff}} = U - J = 5.0\ \mathrm{eV}` — cosmetic
7. `d_0(\text{Ce–O}) = a\sqrt{3}/4` — cosmetic
8. `\varepsilon_\infty \approx 5\text{–}7,\quad \varepsilon_0 \approx 20\text{–}30` — cosmetic

# Physics expressions with structure (9–20)

9. `E_U = \frac{U_{\mathrm{eff}}}{2} \sum_{I,\sigma} \mathrm{Tr}\left[ n^{I\sigma} - n^{I\sigma} n^{I\sigma} \right]` — cosmetic
10. `E_U^{\mathrm{deloc}} = \frac{U_{\mathrm{eff}}}{2}\sum_{i=1}^{M}\frac{1}{M}\left(1-\frac{1}{M}\right)` — cosmetic
11. `V_{U,m} = \frac{\partial E_U}{\partial \lambda_m} = U_{\mathrm{eff}}\left(\frac{1}{2}-\lambda_m\right)` — cosmetic
12. `E_{\mathrm{H}}[n] = \frac{1}{2}\iint \frac{n(\mathbf{r})\,n(\mathbf{r}')}{\lvert \mathbf{r}-\mathbf{r}'\rvert}\,d\mathbf{r}\,d\mathbf{r}'` — cosmetic
13. `E(N+\eta) = (1-\eta)\,E(N) + \eta\,E(N+1), \qquad 0 \le \eta \le 1` — cosmetic
14. `E_{\mathrm{xc}}^{\mathrm{HSE}} = a\,E_{\mathrm{x}}^{\mathrm{HF,SR}}(\omega) + (1-a)\,E_{\mathrm{x}}^{\mathrm{PBE,SR}}(\omega) + E_{\mathrm{x}}^{\mathrm{PBE,LR}}(\omega) + E_{\mathrm{c}}^{\mathrm{PBE}}` — cosmetic
15. `\{\mathbf{R}_i, Z_i\} \longrightarrow E, \qquad \mathbf{F}_i = -\frac{\partial E}{\partial \mathbf{R}_i}` — cosmetic
16. `\hat{H}_{\mathrm{SOC}} = \xi(r)\,\mathbf{L}\cdot\mathbf{S}` — cosmetic
17. `q^2/(\varepsilon L)` inside prose-style math: `\Delta E \sim \frac{q^2}{\varepsilon L}` — cosmetic
18. `\lim_{M \to \infty} \frac{U_{\mathrm{eff}}}{2}\left(1 - \frac{1}{M}\right) = \frac{U_{\mathrm{eff}}}{2}` — cosmetic
19. `\int_{\Omega} \rho(\mathbf{x})\,\mathrm{d}V` — cosmetic
20. `x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}` — identical

# Multiline environments — the known weak spot (21–28)

21. `\begin{pmatrix} a_1 & a_3 \\ a_2 & a_4 \end{pmatrix}` — identical
22. `\begin{aligned} 3(a+b)+b-a &= 3a+3b+b \\ &= 3a+4b-a \\ &= 2a+4b \end{aligned}` — cosmetic (must pass, D17)
23. `\begin{bmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{bmatrix}` — identical
24. `\begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc` — cosmetic
25. `\begin{cases} a_1 & \text{if } k > 0 \\ a_2 & \text{if } k < 0 \end{cases}` — cosmetic (must pass, D17)
26. `\begin{gathered} a + b = c \\ f = x + y \end{gathered}` — cosmetic
27. 4×4 matrix with dots: `\begin{pmatrix} a_{1,1} & \cdots & a_{1,n} \\ \vdots & \ddots & \vdots \\ a_{n,1} & \cdots & a_{n,n} \end{pmatrix}` — cosmetic
28. Nested: matrix containing fractions: `\begin{pmatrix} \frac{1}{2} & 0 \\ 0 & \frac{1}{3} \end{pmatrix}` — cosmetic

# Delimiters and nesting (29–33)

29. `\left( \frac{a}{b} \right)^{2}` — cosmetic
30. `\left\{ \frac{a}{a} \middle| \frac{H_2 O}{H_2} \right\}` — cosmetic
31. `\left. \frac{a}{b} \right|_{x=0}^{x=1}` — cosmetic
32. Three-deep: `\left[ 1 + \left( \frac{1}{1 + \left( \frac{x}{2} \right)^2} \right) \right]^{-1}` — cosmetic
33. `\left\langle \psi \middle| \hat{H} \middle| \psi \right\rangle` — cosmetic

# Fonts and mixed content (34–36)

34. `\mathcal{L}, \mathbf{a}, n \subset \left( \mathbb{R} \cap \mathbb{N}^{*} \right)` — cosmetic
35. `f \in C^1(U), \quad K \subset X \text{ compact}` — cosmetic
36. `\forall \varepsilon > 0\;\exists \delta > 0 : d(x,y) < \delta \Rightarrow |f(x)-f(y)| < \varepsilon` — cosmetic

# Known-hostile (37–40) — documenting behavior; failures here don't count against the threshold if gracefully preserved as raw

37. `\operatorname{Res}_{z=z_0} f(z)` — cosmetic-or-raw
38. `\underbrace{x + x + \cdots + x}_{n\text{ times}}` — cosmetic-or-raw
39. `\overset{!}{=}` — cosmetic-or-raw
40. `e^{-2\pi} \big/ \Bigl(1+\frac{e^{-4\pi}}{1+\cdots}\Bigr)` — cosmetic-or-raw

# Edit-naturally checks (performed on a sampled subset during Spike A)

For items 9, 12, 20, 22, 25, 28, 29: enter the expression, navigate into an interior slot by arrows alone, change one token, exit, and verify only that token changed in the serialization. For 22 and 25: additionally add one row and verify a well-formed new `\\` row appears.
