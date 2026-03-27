# NextStep Science

NextStep Science is a safety-first AI lab assistant designed to help researchers reason over experiments without replacing scientific judgment.

The system can interpret experimental protocols, analyze results from text, CSV files, PDFs, or images, and suggest bounded next-step variations with clear explanations. It is built with a strong focus on explainability, responsible AI, and safe orchestration across Azure services.

---

## Project Goal

The goal of this project is to build an AI-powered research support tool that helps users:

- Understand experimental inputs
- Analyze structured and unstructured results
- Surface uncertainties and missing context
- Suggest safe next-step options
- Explain why each recommendation is made
- Avoid unsafe or disallowed advisory behavior

This is not meant to replace a scientist, clinician, or domain expert. It is an assistive tool for structured reasoning and safe exploration.

---

## Core Idea

The product receives an experiment description or uploaded file, processes the content, applies safety checks, and generates a structured response with:

- Protocol Interpretation
- Results Analysis
- Next Step Recommendations
- Rationale / Why
- Safety / Confidence Notes

---

## Main User Flow

1. User enters an experiment description or uploads a file
2. File is stored in Azure Blob Storage
3. If needed, the content is extracted from PDFs or images
4. Safety checks are applied to the input
5. The AI system analyzes the experiment and generates a structured response
6. Safety checks are applied again to the output
7. The result is shown in the web interface

---

## Azure Architecture Overview

### 1. Frontend
**Purpose:** User interface for uploading files, writing experiment descriptions, and viewing results.

**Tech:**
- React
- Vite
- JavaScript
- HTML / CSS or Tailwind

**Azure Hosting:**
- Azure Container Apps

**Owned by:**
- Web UI team

---

### 2. File Storage Layer
**Purpose:** Store uploaded CSVs, PDFs, and images.

**Azure Service:**
- Azure Blob Storage

**What goes here:**
- Raw user uploads
- Temporary processed files if needed

**Owned by:**
- AI / backend team

---

### 3. Backend Orchestration Layer
**Purpose:** Receive requests from the UI, route the data, call Azure AI services, and return the final result.

**Azure Service:**
- Azure Functions

**Main responsibilities:**
- Receive experiment text or file reference
- Trigger extraction if needed
- Call safety checks
- Call AI reasoning layer
- Return structured JSON response

**Owned by:**
- AI / backend team

---

### 4. Document and Image Extraction
**Purpose:** Read and extract content from PDFs, scanned documents, or images.

**Azure Service:**
- Azure AI Document Intelligence

**Used for:**
- PDF protocols
- Images containing notes, tables, or results
- Scanned lab documents

**Not needed for:**
- Plain text input
- Raw CSV files

**Owned by:**
- AI / backend team

---

### 5. Safety Layer
**Purpose:** Enforce responsible AI boundaries and filter unsafe or disallowed content.

**Azure Service:**
- Azure AI Content Safety

**Used for:**
- Input moderation
- Output moderation
- Blocking unsafe biological or clinical-style advisory behavior
- Detecting risky content patterns

**Owned by:**
- AI / safety logic team

---

### 6. Reasoning Layer
**Purpose:** Interpret the experiment, analyze the content, and produce structured recommendations.

**Azure Service:**
- Azure OpenAI

**What it does:**
- Understand the protocol
- Analyze results
- Identify uncertainty
- Suggest bounded next-step options
- Explain the reasoning

**Owned by:**
- AI team

---

### 7. Retrieval / Grounding Layer
**Purpose:** Provide relevant context from uploaded experiment documents or indexed project files.

**Azure Service:**
- Azure AI Search

**Used for:**
- Retrieval over uploaded documents
- Grounded responses
- RAG-style architecture
- Future support for experiment history or notebook memory

**Owned by:**
- AI / backend team

---

### 8. Monitoring and Diagnostics
**Purpose:** Track system health, logs, response times, and failures.

**Azure Services:**
- Azure Monitor
- Application Insights

**Used for:**
- Error logging
- Request tracing
- Performance monitoring
- Demo reliability

**Owned by:**
- Backend / platform team

---

## Suggested Team Split

### Web UI Team
Responsible for:
- Main interface design
- Upload experience
- Input form
- Result cards
- Loading state
- Safety badge / status
- Connecting frontend to backend API

**Frontend deliverable:**
A single main screen where the user can:
- Write an experiment description
- Upload a CSV, PDF, or image
- Click `Analyze Experiment`
- View structured results

---

### AI / Backend Team
Responsible for:
- Azure setup
- Blob Storage integration
- Azure Functions API
- Document extraction
- Content Safety flow
- Azure OpenAI prompting and structured output
- Optional Azure AI Search integration

**Backend deliverable:**
A working API that receives input and returns structured analysis.

---

## Suggested Structured Output

```json
{
  "protocol_interpretation": "Summary of what the system understood from the experiment.",
  "results_analysis": "Analysis of the uploaded data, image, or protocol findings.",
  "next_step_recommendations": [
    {
      "type": "conservative",
      "suggestion": "Repeat measurement with one controlled variable adjusted.",
      "why": "This helps validate whether the observed trend is stable."
    }
  ],
  "uncertainties": [
    "Sample size is not clearly specified."
  ],
  "safety_status": "checked"
}
```
