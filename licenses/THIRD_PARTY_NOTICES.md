# Third party notices — OT Gastro Lab V0.2 (includes V0.1/V0.1.1)

Croissant: Dario Barresi (scan), Greg Zaal (processing), Poly Haven.
https://polyhaven.com/a/croissant — CC0-1.0.
Asset downloaded directly from Poly Haven on 2026-11-27. Recentered, grounded,
normalized to 0.2 m width, textures re-encoded, GLB and USDZ generated locally.
Poster rendered locally from the GLB; no Poly Haven preview artwork copied.
License evidence: https://polyhaven.com/license .
Powered by Poly Haven. The deployed application does not call the Poly Haven API.

@google/model-viewer 4.4.0 — Apache-2.0, Copyright Google LLC.
https://github.com/google/model-viewer/tree/v4.4.0
Official npm distribution, unmodified, self-hosted. Full license in model-viewer.txt.

three 0.183.0 — MIT, Copyright three.js authors.
Used by the official viewer and for offline USDZ conversion; license in three.txt.
The USDZExporter uses three's bundled fflate (MIT, Copyright Arjun Barrett).
The distribution retains its embedded fflate notice; full fflate notice is also
recorded below from the official three source.

Bundled dependencies: lit, lit-element, lit-html, @lit/reactive-element — BSD-3-Clause;
@monogrid/gainmap-js — MIT; promise-worker-transferable — Apache-2.0;
is-promise — MIT; immediate — MIT; lie — MIT; @lit-labs/ssr-dom-shim — BSD-3-Clause;
@types/trusted-types — MIT (type definitions, not runtime code).
Full texts distributed alongside this file. The BSD-3-Clause text for the Lit
family is in lit.txt; per-file copyright notices in the official bundle are preserved.
The dependency graph and exact resolutions are recorded in package-lock.json.

fflate notice:
Copyright (c) 2020 Arjun Barrett
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

No code or models were copied from the seven restaurant projects under review.
OT-authored source is reserved for OLEGARIO TECH; it is not relicensed by the
licenses of the dependencies or assets.


V0.1.1 mobile derivative: croissant-mobile-v011.glb is derived locally from
the preserved calibrated CC0 croissant.glb above. Geometry, normals, UVs,
tangents, coordinate system and physical dimensions are unchanged. The three
PBR textures are resized to 1024x1024 and re-encoded as JPEG. This derivative
remains CC0-1.0. The original GLB and original USDZ are retained unchanged.
No Draco, Meshopt or KTX2 compression is required by the delivered derivative.

## V0.2 — added assets (2026-11-27)

Burger ProjTest by pondohva — Creative Commons Attribution 4.0 International.
https://sketchfab.com/3d-models/77ce9161326f4e4b8615bc0d14754837
https://creativecommons.org/licenses/by/4.0/
Original scan obtained through the public Allen Institute Objaverse redistribution,
matching the source UID, author and embedded source license. Individual asset
license verified against Sketchfab model metadata; the dataset license is not
used as a substitute for the model license. No paid asset was purchased.
Files: assets/models/burger-v02.glb, burger-v02.usdz,
assets/posters/hamburguer.webp (rendered locally from the derivative).
Changes by OLEGARIO TECH: remove scanning support and a thin lower section,
weld vertices, reduce mesh, close underside with a flat brown surface, resize
texture to 1024px, JPEG re-encoding, center, ground and normalize width to 0.14m,
convert GLB/USDZ and render image. The reconstructed underside is not a scan.
The derivative remains CC BY 4.0; no endorsement by the author is implied.

Margherita pizza on plate by Shisma — CC BY 4.0.
https://commons.wikimedia.org/wiki/File:Margherita_pizza_on_plate.jpg
https://creativecommons.org/licenses/by/4.0/
File: assets/posters/pizza-margherita.webp. Resized to 960x720, converted to WebP;
CSS presentation crops the image in catalog rows. Photograph only: this is not
a 3D model and is not used as a camera overlay or simulated AR.

Prato com arroz e feijão, frango grelhado, batata frita, salada e ovo frito
como adicionais, by Tet — CC0 1.0.
https://commons.wikimedia.org/wiki/File:Prato_com_arroz_e_feij%C3%A3o,_frango_grelhado,_batata_frita,_salada_e_ovo_frito_como_adicionais.jpg
https://creativecommons.org/publicdomain/zero/1.0/
File: assets/posters/prato-executivo.webp. Resized to 960x867, converted to WebP;
CSS presentation crops the image in catalog rows. Photograph only; no 3D/AR.

Sources were checked on 2026-11-27. Private audit records are excluded from the
public repository and Pages artifact. The two photograph-only catalog entries
have no GLB or USDZ URL. The V0.1/V0.1.1 croissant assets and original licenses
remain unchanged. No restaurant code, Paprika3D runtime or AI-generated food
asset was incorporated. V0.2 remains a local proof of concept pending release.
