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

from odoo import models, fields, api

class procurement_order(models.Model):
    _inherit = 'procurement.order'
    _name = 'procurement.order'

    ad_is_model_variant = fields.Boolean()

    @api.v7
    def _get_po_line_values_from_proc(self, cr, uid, procurement, partner, company, schedule_date, context=None):

        res = super(procurement_order, self)._get_po_line_values_from_proc(cr, uid, procurement, partner, company, schedule_date, context=context)
        res['ad_is_model_variant'] = procurement.ad_is_model_variant

        return res