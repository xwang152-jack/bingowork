---
name: docx
description: Best practices for creating Microsoft Word (docx) documents
input_schema:
  type: object
  properties:
    content:
      type: string
      description: The content to be written
    filename:
      type: string
      description: The name of the file
---
# Creating High-Quality DOCX Documents

When the user asks for a Word document, report, or formal paper, follow these best practices:

1.  **Iterative Content Creation**:
    - For short documents (< 2 pages), you can generate the content in memory and write it.
    - For long documents, create an initial outline first.

2.  **Formatting**:
    - Use Markdown-style headers (#, ##) for structure.
    - Use clean lists (-).
    - Avoid complex tables if possible; use clean tab-separated or simple text tables unless you have a specific tool for table layout.

3.  **File Naming**:
    - Use descriptive filenames ending in `.docx`.
    - Example: `Quarterly_Report_Q1_2025.docx`

4.  **Verification**:
    - After creating the file, provide a "View" link: `[View Document](file:///absolute/path/to/file.docx)`

This skill ensures that documents are professional, readable, and correctly formatted.
