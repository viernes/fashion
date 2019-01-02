odoo.define('common_models.model_widget', function (require) {

    var core = require('web.core');
    var Widget= require('web.Widget');
    var widgetRegistry = require('web.widget_registry');
    var FieldManagerMixin = require('web.FieldManagerMixin');

    var data = require('web.data');
    var time = require('web.time');
    var utils = require('web.utils');

    var QWeb = core.qweb;
    var _t = core._t;

    var model_widget = Widget.extend({
        template: 'AttributeModels',
        events: {
            "click #sync_models": "update_order_lines",
            "click .row_delete>button": "delete_row",
            "click #copy_to_all": "copy_to_all"
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

        display_data: function () {
            var self = this;
            self.initialized = true;
            self.$el.html(QWeb.render("AttributeModels", {widget: self}));
            /*if (self.common_model_name != 'account.invoice') {
                // don't add models in invoices, just use them
                self.init_add_model();
            }
            self.set_read_write();*/
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
                    $(model_element).find('.oe_total_price').html("0.00");
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