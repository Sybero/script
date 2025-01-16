// #popclip extension for AI Translate
// name: AI Translate
// icon: iconify:fluent:calligraphy-pen-24-regular
// language: javascript
// module: true
// entitlements: [network]
// options: [{
//   identifier: apikey, label: API Key, type: string,
//   description: 'Obtain API key from https://platform.openai.com/account/api-keys'
// }]

async function chat(input, options, lang) {
  const openai = require("axios").create({
    baseURL: "https://ai.chatbro.cn/v1",
    headers: { Authorization: `Bearer ${options.apikey}` },
  });

  let messages;
  messages = [
    {
      role: "system",
      content:
        "你現在是一位英文翻译专家，專注於翻译用户提供的内容。如果括弧內是中文，請將其翻譯成英文；如果是英文，則翻譯成简体中文。請注意，你無需對括弧內的內容提出任何評論或解答，僅需提供準確的翻譯。",
    },
    {
      role: "user",
      content: input.text,
    },
  ];

  const { data } = await openai.post("/chat/completions", {
    model: "gpt-4o",
    messages,
  });
  const result = data.choices[0].message;
  return result.content.trim();
}

exports.actions = [
  {
    title: "AI Translate zh/en",
    icon: "square filled 翻",
    after: "paste-result", 
    code: async (input, options) => chat(input, options, "zh"),
  },
];
