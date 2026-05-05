const DEFAULT_STORY_DATA = {
    storyTitle: "NEXUS STORY",
    storySubtitle: "CHAPTER 1: INITIALIZATION",
    theme: "nasapunk.css",
    characters: {
        "NARRATION": { 
            name: "SYSTEM", 
            sprites: { neutral: "" }, 
            position: "center",
            sfx: "",
            description: "System voice"
        }
    },
    backgrounds: {
        "1": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920"
    },
    chapterNames: {
        "1": "The Beginning"
    },
    chapterBackgrounds: {
        "1": ""
    },
    chapterMusic: {
        "1": ""
    },
    initialState: [
        { id: 'var_sanity', key: 'sanity', value: 10 },
        { id: 'var_gold', key: 'gold', value: 0 }
    ],
    storyDialogue: [
        {
            id: "node_1",
            type: "dialogue",
            x: 100,
            y: 100,
            data: {
                character: "NARRATION",
                text: "The Nexus is online. Awaiting narrative injection.",
                chapter: 1,
                scene: 1
            }
        }
    ]
};
