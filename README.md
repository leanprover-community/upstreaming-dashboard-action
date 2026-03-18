# Upstreaming dashboard data generation
Projects that depend on `Mathlib` will typically want to contribute some files into `Mathlib` itself. These files, which we can call 'upstreaming candidates', will exist in the downstream repository while they are being developed. The action inspects one of these downstream repositories looking for upstreaming candidates that look ready to ingest into `Mathlib`, and also files that look "easy to unlock" for upstreaming (see below).

For this action to work, the 'downstream' repository must follow the same directory and filename structure as Mathlib for their upstreaming candidates. Thus if a downstream developer has results which they plan to upstream to the Mathlib file `A/B/C.lean`, they should create a file `Mathlib/A/B/C.lean` under their project directory. The dashboard will then highlight any open PRs to the Mathlib repository containing the corresponding file.

## Inputs
| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `website-directory` | yes | `.` | Website directory. Files will be generated under {website-dir}/_includes/_upstreaming_dashboard |
| `project-name` | yes | — | Project namespace used to locate files and detect dependencies. For example, `MyProject` or `My.Project`. |
| `include-drafts` | no | `false` | If `true`, include draft PRs under each file in `ready_to_upstream.md`. |
| `relevant-labels` | no | — | Comma- or newline-separated list of labels to classify PRs in `ready_to_upstream.md`. |
| `branch-name` | no | `main` | Branch name used to build source links in the generated markdown. |

## Outputs
This action does not define any outputs. It writes files to disk instead.

## Generated files
The following files are generated under `{website-directory}/_includes/_upstreaming_dashboard`. Users are expected to consume these files via `{% include _upstreaming_dashboard/... %}` Jekyll directives.

### Dashboard:
- `dashboard.md`: a top-level dashboard page that includes all the sections below

### Individual sections of the dashboard
- `ready_to_upstream_snippet.md`: section header + description + include for the ready list.
- `easy_to_unlock_snippet.md`: section header + description + include for the easy-to-unlock list

### Individual lists without descriptions
- `ready_to_upstream.md`: `.lean` files with zero sorries and no inter-project imports.
- `easy_to_unlock.md`: `.lean` files with one or more sorries and no inter-project imports.

## Usage
The files are intended for direct inclusion in a Github Pages page using the Jekyll site generator. The simplest way to consume the dashboard is to add `{% include _upstreaming_dashboard/dashboard.md %}` as the body of one of the pages, but the finer-grained snippets described above are provided for customizability (also see below for a note on CSS styling).

## Local execution
You can run the generator locally through the wrapper script in `scripts/run-local.js`. It runs the action from the given input directory, stages output through a temporary website directory, and then copies the generated dashboard files directly into your chosen output directory:

```sh
node scripts/run-local.js \
  --input-directory /path/to/project \
  --project-name Batteries \
  --output-directory website/_includes/_upstreaming_dashboard \
  --branch-name main \
  --relevant-labels "maintainer merge,delegated"
```

This preserves `src/index.js` as the action entrypoint. Relative output paths are resolved from `--input-directory`, and if `--repo-url` is omitted the wrapper tries to infer it from the input repository's `origin` remote. The script still fetches open PR data from the queueboard service, so local runs require network access.

### Step-by-step example
1. Put your upstreaming candidates in paths matching the corresponding `Mathlib` files.

   For example, if you eventually want to upstream to `Mathlib/Algebra/MyLemma.lean`, keep the downstream file at that same path in your repository.

2. Create a GitHub Pages page that includes the generated dashboard.

   For example, if your site lives in `website`, create `website/index.md` containing:

   ```md
   ---
   layout: default
   title: Dashboard
   ---

   {% include _upstreaming_dashboard/dashboard.md %}
   ```

3. Add a GitHub Actions workflow that checks out the repository, runs this action, and then builds and deploys your Jekyll site.

4. Configure the inputs for your project.

   - Set `website-directory` to the directory containing your Jekyll site.
   - Set `project-name` to the namespace used by your project, for example `MyProject`.
   - Optionally set `relevant-labels` if you want PRs grouped into "Selected" and "Other".

   For example (again, the site here is under the `website` directory):
   ```yaml
         - name: Generate upstream dashboard snippets
           uses: leanprover-community/upstreaming-dashboard-action@main
           with:
             website-directory: website
             project-name: MyProject
             relevant-labels: t-algebra
   ```


5. After the workflow runs, the action will write the generated markdown files under `{website-directory}/_includes/_upstreaming_dashboard`, and your Pages site will render them as per step 2 above.


## Notes
- The current version of the task is designed for projects that upstream to `leanprover-community/mathlib4`. Support for generic projects could be implemented in a future version.
- Links in the generated markdown use the `branch-name` input (defaults to `main`).
- PR entries in `ready_to_upstream.md` include tags derived from PR labels, colored and linked when label metadata is available.
- When `relevant-labels` is set, PRs are grouped into "Selected" (has at least one matching label) and "Other".
- The generated markup uses `upstreaming-dashboard-*` CSS classes so you can style it via your site CSS (inspect the generated files for the exact class names).
