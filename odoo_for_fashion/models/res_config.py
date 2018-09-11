# -*- coding: utf-8 -*-
# -*- coding: utf-8 -*-
##############################################################################
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################
#

from odoo import api, fields, models, _


class base_config_settings(models.TransientModel):
    _inherit = 'res.config.settings'


    default_model_attribute = fields.Many2one('product.attribute',
                                              string='Default attribute grouping')  # , default_model='project.template')
    module_product_tags = fields.Boolean('Use Tags on Products & Product variants')
    module_sale_models = fields.Boolean('Use O4F on Sales')
    module_purchase_models = fields.Boolean('Use O4F on Purchases')
    module_account_models = fields.Boolean('Use O4F on Accounting')
    module_product_models_pricelist = fields.Boolean('Create pricelists with O4F')
    module_product_cost = fields.Boolean('Product Cost Caculation')
    module_product_barcode_generator = fields.Boolean('Generate EAN13 Internal barcodes for products')
    module_product_barcode = fields.Boolean(
        'Print barcode labels with a Dymo label printer (install Dymo software, use on Firefox)')
    module_website_multi_image_zoom = fields.Boolean('Add Multiple image per product and variant')
    module_pos_visual_improvements = fields.Boolean('Various visual improvement for Point of Sale')
    module_pos_receipt_note = fields.Boolean('Extra Note on receipt in Point of Sale')

    # module_stock_models = fields.Boolean('Use o4wfrs on stock moves')

    @api.model
    def get_default_model_attribute(self, fields):
        """
        Method argument "fields" is a list of names
        of all available fields.
        """

        default = self.env['ir.default'].sudo().get('product.template', 'model_attribute',
                                                     company_id=self.company_id.id or self.env.user.company_id.id)
        if default is not None:
            return {
                'default_model_attribute': default[0]
            }
        else:
            return {}

    @api.multi
    def set_values(self):
        super(base_config_settings, self).set_values()
        default = self.env['ir.default'].sudo().set('product.template', 'model_attribute',
                                          self.default_model_attribute and self.default_model_attribute.id or False,
                                          company_id=self.company_id.id or self.env.user.company_id.id)
