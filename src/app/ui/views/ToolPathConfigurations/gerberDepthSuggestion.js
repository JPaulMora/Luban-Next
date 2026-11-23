import { recommendedIsolationDepth } from '../../../../shared/lib/gerber/cuttingWidth';

const toolFromDefinition = (definition) => {
    const settings = (definition && definition.settings) || {};
    const value = (setting) => (setting ? setting.default_value : undefined);
    return {
        toolType: value(settings.tool_type),
        toolAngle: value(settings.angle),
        toolDiameter: value(settings.diameter),
        definitionName: definition && definition.name,
    };
};

const finestGapOf = (toolPath, modelGroup) => {
    const ids = (toolPath && toolPath.visibleModelIDs) || [];
    if (!modelGroup || !ids.length) {
        return null;
    }
    let gap = null;
    ids.forEach((id) => {
        const model = modelGroup.getModel(id);
        const value = Number(model && model.config && model.config.finestGap);
        if (value > 0 && (gap == null || value < gap)) {
            gap = value;
        }
    });
    return gap;
};

const angleText = (angle) => {
    const n = Number(angle);
    if (Math.abs(n - Math.round(n)) < 1e-6) {
        return String(Math.round(n));
    }
    return n.toFixed(1);
};

// Depth to offer under Target Depth, for the bit currently selected.
const gerberDepthSuggestion = (toolPath, modelGroup, definition) => {
    const gap = finestGapOf(toolPath, modelGroup);
    const tool = toolFromDefinition(definition);
    const depth = recommendedIsolationDepth(tool, gap);
    if (depth == null) {
        return null;
    }
    return {
        depth,
        angleText: angleText(tool.toolAngle),
        gapText: Number(gap).toFixed(2),
    };
};

export default gerberDepthSuggestion;
