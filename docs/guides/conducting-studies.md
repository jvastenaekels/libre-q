# Researcher Handbook

This guide is intended for researchers who want to use Open-Q to conduct Q-methodology studies.

## 📋 The Q-Methodology Workflow

Open-Q streamlines the traditional Q-sort process into a modern, digital experience:

1.  **Preparation**: Define your set of statements (the Q-set) and the shape of your grid (the distribution).
2.  **Onboarding**: Participants read your instructions and provide informed consent.
3.  **Phase 1: Pre-sort (Context)**: Collect demographic or contextual data.
4.  **Phase 2: Rough Sort**: Participants categorize statements into "Agree", "Neutral", and "Disagree" piles.
5.  **Phase 3: Fine Sort (The Grid)**: Participants place statements into a forced distribution grid.
6.  **Phase 4: Post-sort (Reflections)**: Participants provide qualitative feedback on their placements.

### Recruitment Analytics

Track your participant conversion funnel in real-time on the **Recruitment** page:

- **Started**: Participants who accessed your study via a recruitment link.
- **Submitted**: Participants who fully completed the sorting session.
- **Success Rate**: The percentage of starts that resulted in a submission.

> [!TIP]
> A high drop-off rate (low success rate) often indicates that your instructions or statements are too complex, or that the Sorting Grid is too large for mobile participants.

### Study Access Security

You can restrict access to your study in two ways:

1.  **Public Access**: Anyone with the link can participate.
2.  **Password Protected**: Participants must enter a broad "access password" before they can view the study configuration (Consent, Statements, etc.).

> [!NOTE]
> Passwords can be set or changed at any time in the **Design** tab of your study.

### Tips for a Great Q-Sort

- **Statement Clarity**: Keep statements concise and balanced.
- **Instructional Design**: Use the `instructions` field in `StudyTranslation` to explain the specific context of your study. You can use **Markdown** for formatting.
- **Grid Balance**: Ensure the number of slots in your grid matches the total number of statements in your Q-set.

## 📊 Collecting Data

Once your study is "active", every completed sort by a participant is stored as a unique session.

- Participants receive a **Confirmation Code** at the end of the study.
- All data is anonymized by default.

For details on how to retrieve this data, see the [Data Export Guide](data-export.md).
