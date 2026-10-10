# Contributing to GenMuza

Reports and pull requests are welcome. You can write in Russian or English.

For a bug report, include the browser and operating system, the steps to reproduce, expected and actual behavior, and the seed and settings. If possible, attach an exported JSON project that demonstrates the problem. Remove personal text from the project before sharing it.

For a musical improvement, include a short description of what sounds wrong and the relevant seed or JSON project. An audio example is useful.

Run `npm test` before sending a code change. Run `npm run dev` to check the interface. No package installation or build step is needed. Model setup is optional for changes to the procedural composer; use `npm run prepare-model` to test neural mood planning.

Keep the composer deterministic for a fixed seed. Preserve the JSON project format, offline operation, and dependency license notices. Explain what changed and how you checked it in your pull request.
