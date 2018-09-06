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

from odoo import api, fields, models, _, tools


class product_product(models.Model):
    _name = "product.product"
    _inherit = "product.product"
    _order = "name,sequence"

    sequence = fields.Integer(compute="_compute_sequence", store=True)

    @api.depends("attribute_value_ids", "attribute_value_ids.sequence")
    def _compute_sequence(self):
        for product in self:
            if not len(product.attribute_value_ids):
                continue
            if product.attribute_value_ids[0].sequence != 0 :
                product.sequence = product.attribute_value_ids[0].sequence
            else:
                product.sequence = product.attribute_value_ids[0].id


class product_template(models.Model):
    _name = 'product.template'
    _inherit = 'product.template'

    model_attribute = fields.Many2one('product.attribute', string='Attribute grouping')

    # When the model attribute is changed, delete all current variants and replace them with the standard variants
    @api.onchange('model_attribute')
    def on_model_attribute_change(self):
        if not self.model_attribute:
            return

        values = self.env['product.attribute.value'].search([('attribute_id', '=', self.model_attribute.id)])

        # Don't look at the rest, just replace them (tested, the rest is deleted from the database)
        self.attribute_line_ids = [(0, 0, {
            'attribute_id': self.model_attribute.id,
            'value_ids': values.ids,
        })]


class product_model_filter(models.Model):
    _name = 'product.template.model'
    _auto = False

    name = fields.Text('name', readonly=True, translate=True)

    @api.model_cr
    def init(self):
        tools.drop_view_if_exists(self._cr, 'product_template_model')
        self._cr.execute("""
            CREATE VIEW product_template_model as
            (
                SELECT MIN(prod.id) as id, prod.name as name
                FROM product_template prod, product_attribute_line att
                WHERE model_attribute IS NOT NULL
                    AND att.product_tmpl_id = prod.id
                    AND att.attribute_id = prod.model_attribute
                    AND prod.active = True
                    AND sale_ok = True
                GROUP BY prod.name
            )
        """)

