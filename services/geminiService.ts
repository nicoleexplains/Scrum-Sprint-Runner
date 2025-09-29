import { GoogleGenAI, Type } from "@google/genai";
import type { Attachment } from '../types';

let ai: GoogleGenAI | undefined;

function getAiClient(): GoogleGenAI {
    if (!ai) {
        const API_KEY = process.env.API_KEY;
        if (!API_KEY) {
            throw new Error("API_KEY environment variable not set. Please configure it to use AI features.");
        }
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    return ai;
}


const userStorySchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: "A concise, descriptive title for the user story."
        },
        description: {
            type: Type.STRING,
            description: "A detailed description of the user story from an end-user perspective, following the 'As a [user], I want [action], so that [benefit]' format."
        },
        points: {
            type: Type.INTEGER,
            description: "An estimated story point value (e.g., 1, 2, 3, 5, 8) based on complexity and effort."
        },
    },
    required: ["title", "description", "points"],
};

export const generateUserStories = async (featureIdea: string) => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the high-level feature idea "${featureIdea}", generate a list of 3-5 detailed user stories for a scrum backlog.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: userStorySchema
                },
            },
        });

        const jsonText = response.text.trim();
        const stories = JSON.parse(jsonText);
        
        // Basic validation
        if (!Array.isArray(stories)) {
            throw new Error("AI did not return an array of stories.");
        }
        
        return stories.map(story => ({
            title: story.title || 'Untitled Story',
            description: story.description || 'No description provided.',
            points: typeof story.points === 'number' ? story.points : 0,
        }));

    } catch (error) {
        console.error("Error generating user stories:", error);
        throw error;
    }
};

export const summarizeRetrospective = async (wentWell: string[], couldImprove: string[]): Promise<string> => {
    const prompt = `
        As a scrum master, analyze the following retrospective feedback and provide a concise summary with clear, actionable items for the next sprint.

        What went well:
        ${wentWell.map(item => `- ${item}`).join('\n')}

        What could be improved:
        ${couldImprove.map(item => `- ${item}`).join('\n')}

        Structure your response with a brief summary paragraph followed by a bulleted list of 3-5 specific, actionable recommendations.
    `;

    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing retrospective:", error);
        throw error;
    }
};

export const analyzeTaskAttachments = async (taskTitle: string, attachments: Attachment[]): Promise<string> => {
    if (attachments.length === 0) {
        return "No attachments to analyze.";
    }

    const prompt = `
        You are an expert project manager. Analyze the attached file(s) for the task titled "${taskTitle}". 
        Based on the content of the files, provide a concise summary and a suggested project workflow or a list of sub-tasks.
        Format your response clearly with headings for 'Summary' and 'Workflow/Sub-tasks'.
    `;

    const fileParts = attachments.map(file => {
        // The base64 string from FileReader includes a data URI prefix, e.g., "data:image/png;base64,". We need to strip it.
        const base64Data = file.data.split(',')[1];
        if (!base64Data) {
            throw new Error(`Invalid base64 data for file ${file.name}`);
        }
        return {
            inlineData: {
                data: base64Data,
                mimeType: file.type,
            },
        };
    });

    const textPart = { text: prompt };

    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [textPart, ...fileParts] },
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing attachments:", error);
        throw error;
    }
};