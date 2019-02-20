odoo.define('common_models.model_widget', function (require) {

    var core = require('web.core');
    var Widget= require('web.Widget');
    var FormView = require('web.FormView');
    var widgetRegistry = require('web.widget_registry');
    var FieldManagerMixin = require('web.FieldManagerMixin');

    var data = require('web.data');
    var time = require('web.time');
    var utils = require('web.utils');

    var QWeb = core.qweb;
    var _t = core._t;

    var model_widget = Widget.extend(FieldManagerMixin, {
        template: 'AttributeModels',
        events: {
            "click #sync_models": "update_order_lines",
            "click .row_delete>button": "delete_row",
            "click #copy_to_all": "copy_to_all"
        },
        get_id_from_class: function (element, class_prefix) {
            if (element == undefined) {
                return;
            }
            var classList = element.className.split(/\s+/);
            for (var i = 0; i < classList.length; i++) {
                if (classList[i].match("^" + class_prefix)) {
                    return parseInt(classList[i].substr(classList[i].indexOf('-') + 1));
                }
            }
        },
        copy_to_all: function (event) {
            console.log('copy_to_all')
            var self = this;
            if (event) {
                event.preventDefault();
            }
            $('.oe-copy-input-field').each(function (index, element) {
                var id = self.get_id_from_class(element, 'attribute-')
                var value = parseFloat($(element).val());
                if (isNaN(value)) {
                    // empty or wrong fields are dismissed
                    return;
                }
                $('.oe-product-input-field.attribute-' + id).each(function (index, element) {
                    $(element).val(value);
                });
                $(element).val('');
            })
        },
        destroy_content: function () {
            var self = this;
            this.set_read_write();
            if (this.dfm) {
                this.dfm.destroy();
                this.dfm = undefined;
            }
        },
        init: function (parent, model, state) {
                this._super(parent);
                FieldManagerMixin.init.call(this);
                var self = this;
                self.o_form_editable = false;
                self.updating = false;
                self.initialized = false;
                self.reload_after_save = false;
                self.defs = [];
                self.object_id = model.res_id;
                self.set('measurebars', []);
                var lines = {order_lines: []};
                this.m = model.model
                localStorage.setItem("order_lines", JSON.stringify(lines));
                self.common_quantity_name = ''; // generalisation of the quantity name
                switch (model.model) {
                    case 'sale.order':
                        self.common_quantity_name = 'product_uom_qty';
                        self.common_lines_name = 'order_line';
                        break;
                    case 'purchase.order':
                        self.common_quantity_name = 'product_qty';
                        self.common_lines_name = 'order_line';
                        break;
                    case 'account.invoice':
                        self.common_quantity_name = 'product_qty';
                        self.common_lines_name = 'invoice_line_ids';
                        break;
                    default:
                        alert("The widget wil not work properly on this view, only works on sale.order or purchase.order");
                }
                self.common_model_name = model.model;
                this.model.original_save = _.bind(this.model.save, model);
                this.model.save = function (prepend_on_create) {
                    console.log('save')
                    self.prepend_on_create = prepend_on_create;
                    if (!self.get("effective_readonly")) {
                        self.update_order_lines(false)
                    }
                    //self.update_order_lines(false);
                    return $.when.apply($, self.defs).then(function () {
                        self.reload_after_save = true;
                        return self.model.original_save(self.prepend_on_create);
                    });
                };
            },
            init_add_model: function () {
                var self = this;
                console.log('init_add_model');
                FieldManagerMixin;
                if (self.get("effective_readonly")) {
                    return;
                }

                if (self.dfm) {
                    self.destroy_content();
                }

                self.$(".oe_models_add_row").show();
//                self.dfm = new form_common.DefaultFieldManager(self);
//                self.dfm.extend_field_desc({
//                    models: {
//                        relation: "product.template.model"
//                    }
//                });

                var currentids = [];
                var measurebars = self.get('measurebars');
                for (var i = 0; i < measurebars.length; i++) {
                    var bar = measurebars[i];
                    for (var j = 0; j < bar.models.length; j++) {
                        var model = bar.models[j];
                        currentids.push(model.product_template_id);
                    }
                }
//                var FieldMany2One = core.form_widget_registry.get('many2one');
//                self.model_m2o = FieldMany2One.include(self.dfm, {
//                    attrs: {
//                        name: "models",
//                        type: "many2one",
//                        domain: [
//                            ['id', 'not in', currentids],
//                        ],
//                        context: {},
//                        modifiers: '{"required": true}'
//                    }
//                });
//
//                self.model_m2o.options.no_create = true;
//                self.model_m2o.options.no_quick_create = true;
//
//                self.model_m2o.prependTo(self.$(".oe_models_add_row"));
                self.$("#add_row").click(function () {
                var id = self.model_m2o.get_value();
                if (id === false) {
                    self.dfm.set({display_invalid_fields: true});
                    return;
                }
                var pricelist_id;
                if (self.view.dataset.model === "purchase.order") {
                    // don't add models in invoices, just use them
                    pricelist_id = 1;
                } else {
                    pricelist_id = self.field_manager.get_field_value('pricelist_id');
                }
                new Model(self.view.model).call("new_model_defaults",
                    [
                        self.field_manager.get_field_value('partner_id'),
                        pricelist_id,
                        self.field_manager.get_field_value('date_order'),
                        self.field_manager.get_field_value('fiscal_position_id'),
                        self.field_manager.get_field_value('state'),
                        id
                    ], {
                        'context': new data.CompoundContext({
                            'user_id': self.get('user_id')
                        })
                    }).then(function (result) {
                    var _measurebars = self.get('measurebars'); //deep copy?
                    for (var i = 0; i < _measurebars.length; i++) {
                        var bar = _measurebars[i];
                        if (bar.id == result.measurebar.id) {
                            // add model to bar
                            bar.models.push(result.measurebar.models[0]);

                            self.set('measurebars', _measurebars);

                            self.updating = true;
                            var linestext = localStorage.getItem("order_lines");
                            var lines = JSON.parse(linestext);
                            var commands = self.field_manager.get_field_value(self.common_lines_name);
                            _.each(result.order_lines, function (item) {
                                commands.push([0, 0, item])
                                lines.order_lines.push(item);
                            });
                            localStorage.setItem("order_lines", JSON.stringify(lines));
                            self.updating = false;
                            self.display_data();
                            return;
                        }
                    }

                    _measurebars.push(result.measurebar)
                    self.set('measurebars', _measurebars);
                    var linestext = localStorage.getItem("order_lines");
                    var lines = JSON.parse(linestext);
                    var commands = self.field_manager.get_field_value(self.common_lines_name);
                    _.each(result.order_lines, function (item) {
                        commands.push([0, 0, item])
                        lines.order_lines.push(item);
                    });
                    localStorage.setItem("order_lines", JSON.stringify(lines));
                    self.updating = true;

                    self.updating = false
                    lines[self.common_lines_name] = commands;
                    //self.field_manager.set_values(lines);

                    self.updating = false;
                    self.display_data();

                })

            });
        },
        display_data: function () {
            var self = this;
            self.initialized = true;
            self.$el.html(QWeb.render("AttributeModels", {widget: self}));
            if (self.common_model_name != 'account.invoice') {
                // don't add models in invoices, just use them
                self.init_add_model();
            }
            self.set_read_write();
        },
        format_currency: function (amount) {
                if (typeof amount === 'number') {
                    amount = Math.round(amount * 100) / 100;
                    amount = amount.toFixed(2);
                }
                return amount;
                /*if(this.currency.position === 'after'){
                 return amount + ' ' + this.currency.symbol;
                 }else{
                 return this.currency.symbol + ' ' + amount;
                 }*/
            },
        start: function() {
            this._super.apply(this, arguments);
            this.$el.append($('<div>').text('Hello dear Odoo user!'));
            var self = this;
            self.destroy_content();
            console.log('start');
            this._rpc({
                model: self.common_model_name,
                method: 'get_model_lines',
                context: {
                    model: self.common_model_name,
                    object_id: self.object_id
                }
            }).then(function (result) {
                        self.querying = true;
                        self.set('measurebars', result);
                        self.querying = false;
                    })
                    .then(function () {
                        self.display_data();
                    });
            console.log('end_start');
            if (self.$("body").find(".o_form_editable").length){
                self.o_form_editable = true;
            }
        },
        set_read_write: function () {
            var self = this;
            if (!self.get("effective_readonly")) {
                //product-{{ product.id }}
                self.execute_on_products(false, false, false, function (bar, model, product) {
                    self.$(".product-" + product.id).val(product.quantity);
                    return product.quantity;
                });
            }
        },
        execute_on_products: function (bar_id, model_id, product_id, product_func) {
            console.log('execute_on_products');
            var self = this;
            var has_changes = false;
            var measurebars = self.get('measurebars');
            _.each(measurebars, function (bar) {
                if (bar_id && bar.id != bar_id) {
                    return;
                }
                _.each(bar.models, function (model) {
                    if (model_id && model.product_template_id != model_id) {
                        return;
                    }
                    var total_qty = 0;
                    _.each(model.products, function (product) {
                        if (!product.id) {
                            // skip empty cells (no variant for the product)
                            return;
                        }
                        if (product_id && product.id != product_id) {
                            total_qty += product.quantity;
                            return;
                        }
                        total_qty += product_func(bar, model, product);
                    });
                    if (total_qty == 0 && model.total_quantity) {
                        return;
                    }
                    has_changes = true;
                    model.total_quantity = total_qty;
                    model.total_price = 0.0;
                    var model_element = self.$(".model-" + model.product_template_id);
                    $(model_element).find('.oe_total_quantity').html(model.total_quantity);
                       $(model_element).find('.oe_total_price').html(model.total_quantity*model.price_unit);
                });
            });
            if (has_changes) {
                self.set('measurebars', measurebars);
            }
        },
    });
    widgetRegistry.add(
        'model_widget', model_widget
    );

});