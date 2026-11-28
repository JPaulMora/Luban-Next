import Operation from '../../core/Operation';
import type ModelGroup2D from '../../models/ModelGroup2D';
import type SvgModel from '../../models/SvgModel';

type ReorderOperation2DProp = {
    modelGroup: ModelGroup2D;
    svgActions: {
        orderElements: (elements: SVGElement[]) => void;
    };
    from: SvgModel[];
    to: SvgModel[];
};

// A new order of the laser or CNC models, from the object list.
export default class ReorderOperation2D extends Operation<ReorderOperation2DProp> {
    public constructor(props: ReorderOperation2DProp) {
        super();
        this.state = {
            modelGroup: props.modelGroup,
            svgActions: props.svgActions,
            from: [...props.from],
            to: [...props.to]
        };
    }

    public redo() {
        this.apply(this.state.to);
    }

    public undo() {
        this.apply(this.state.from);
    }

    private apply(order: SvgModel[]) {
        this.state.modelGroup.setModelOrder(order);
        this.state.svgActions.orderElements(order.map((model) => model.elem));
    }
}
