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

from odoo import models, fields, api, _
from odoo.exceptions import Warning
import openerp.addons.decimal_precision as dp


class sale_order_line(models.Model):
    _name = 'sale.order.line'
    _inherit = 'sale.order.line'

    ad_is_model_variant = fields.Boolean()

    _defaults = {
        'ad_is_model_variant': False,
    }

    @api.multi
    def _prepare_invoice_line(self, qty):
        res = super(sale_order_line, self)._prepare_invoice_line(qty)
        res['ad_is_model_variant'] = self.ad_is_model_variant
        return res


        # def _prepare_order_line_invoice_line(self, cr, uid, line, account_id=False, context=None):
        #     res = super(sale_order_line, self)._prepare_order_line_invoice_line(cr, uid, line, account_id=account_id, context=context)
        #
        #     res['ad_is_model_variant'] = line.ad_is_model_variant
        #
        #     return res
