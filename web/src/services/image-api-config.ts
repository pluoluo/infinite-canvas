import { IMAGE_API_PATH, imageApiRequest } from "@/services/api/image-api";
import { modelOptionsFromChannels, useConfigStore, type ChannelModel, type ModelChannel } from "@/stores/use-config-store";

export async function initializeImageApi() {
    // The upstream standalone application remains usable without image-api.
    if (!import.meta.env.VITE_IMAGE_API) return;
    const metadata = await imageApiRequest<{ app: string; models: ChannelModel[]; provider_models: ChannelModel[] }>(`${IMAGE_API_PATH}/config`);
    if (metadata.app !== "image-api") throw new Error("画布服务配置不正确");
    const { config, webdav } = useConfigStore.getState();
    const channel: ModelChannel = {
        id: "image-api",
        name: "本机生图服务",
        baseUrl: `${location.origin}${IMAGE_API_PATH}`,
        apiKey: "",
        apiFormat: "openai",
        models: metadata.models.map((model) => ({ ...model, script: config.channels.find((item) => item.id === "image-api")?.models.find((item) => item.name === model.name)?.script })),
    };
    const providerModels = config.channels.find((item) => item.id === "image-api-openai")?.models || [];
    const provider: ModelChannel = {
        ...channel,
        id: "image-api-openai",
        name: "本机文本与音频服务",
        baseUrl: `${channel.baseUrl}/openai`,
        models: [...providerModels, ...metadata.provider_models.filter((model) => !providerModels.some((item) => item.name === model.name))],
    };
    const channels = [channel, provider, ...config.channels.filter((item) => item.id !== channel.id && item.id !== provider.id)];
    const firstModel = metadata.models[0]?.name;
    const defaultChannelConfigured = Boolean(config.channels.find((item) => item.id === "default")?.apiKey.trim());
    const unconfiguredDefault = config.imageModel.startsWith("default::") && !defaultChannelConfigured;
    const imageModel = unconfiguredDefault && firstModel ? `image-api::${firstModel}` : config.imageModel;
    useConfigStore.setState({
        config: {
            ...config,
            channels,
            models: modelOptionsFromChannels(channels),
            imageModel,
            model: imageModel,
            textModel: !defaultChannelConfigured && config.textModel.startsWith("default::") && metadata.provider_models.length ? "image-api-openai::gpt-4.1-mini" : config.textModel,
            audioModel: !defaultChannelConfigured && config.audioModel.startsWith("default::") && metadata.provider_models.length ? "image-api-openai::tts-1" : config.audioModel,
        },
        webdav: webdav.url ? webdav : { ...webdav, url: `${location.origin}${IMAGE_API_PATH}/storage` },
    });
}
